import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import productData from '../data/products.json' with { type: 'json' };
import { analyzeNews, generatePlatformContent, planContentStrategy } from '../lib/llm';
import { evaluateMarketingOpportunity, strategyUsesSensitiveHook } from '../lib/marketingOpportunity';
import { matchProducts } from '../lib/productMatcher';
import { sanitizeProductForCopy } from '../lib/productSanitizer';
import type {
  ContentStrategy,
  GenerateResultItem,
  MarketingOpportunityEvaluation,
  NewsAnalysis,
  NewsItem,
  PlatformContents,
  PlatformKey,
  PlatformStatuses,
  Product,
} from '../lib/types';
import { evaluateCase, summarize } from './machineMetrics.mjs';
import { buildBadcasesCsv, buildBacklogCsv } from './resultArtifacts.mjs';
import { EVALUATION_JUDGE_PROMPT } from './prompts/judgePrompt';

type EvaluationCase = {
  id: string;
  category: string;
  scenarioName: string;
  news: { title: string; brief: string };
  product: { sku: string; syntheticProduct: boolean };
  expected: {
    marketingSafe: boolean;
    sensitiveTopic: boolean;
    fitLevel: 'strong' | 'medium' | 'weak';
    shouldGenerate: boolean;
    expectedConsumerNeed: string[];
    expectedRelationshipPath: string[];
    forbiddenAngles: string[];
  };
  [key: string]: unknown;
};

const products = productData as Product[];
const platforms: PlatformKey[] = ['weibo', 'xiaohongshu', 'douyin'];
const emptyContent = (): PlatformContents => ({ weibo: null, xiaohongshu: null, douyin: null });
const emptyStatuses = (): PlatformStatuses => ({ weibo: 'not_generated', xiaohongshu: 'not_generated', douyin: 'not_generated' });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf('--version');
  return {
    version: versionIndex >= 0 ? args[versionIndex + 1] : process.env.EVALUATION_VERSION ?? 'v1.2.2',
    skipJudge: args.includes('--skip-judge') || process.env.EVAL_SKIP_JUDGE === 'true',
    checkConfig: args.includes('--check-config'),
  };
}

async function loadNextEnvironment() {
  const requireFromProject = createRequire(import.meta.url);
  const requireFromNext = createRequire(requireFromProject.resolve('next/package.json'));
  const envModulePath = requireFromNext.resolve('@next/env');
  const envModule = requireFromNext(envModulePath) as {
    loadEnvConfig: (projectDirectory: string, development?: boolean) => unknown;
  };
  envModule.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
}

async function judge(caseData: EvaluationCase, actual: GenerateResultItem, version: string) {
  const endpointBase = requiredEnv('LLM_BASE_URL').replace(/\/+$/, '');
  const endpoint = endpointBase.endsWith('/chat/completions') ? endpointBase : `${endpointBase}/chat/completions`;
  const prompt = EVALUATION_JUDGE_PROMPT.replace('{{EVALUATION_CASE_JSON}}', JSON.stringify({
    datasetVersion: 'evaluation_v1',
    version,
    case: caseData,
    actual,
  }, null, 2));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${requiredEnv('LLM_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: requiredEnv('LLM_MODEL'), messages: [{ role: 'user', content: prompt }], temperature: 0, stream: false }),
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Judge request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content?.trim() ?? '';
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const firstBrace = unfenced.indexOf('{');
  const lastBrace = unfenced.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < firstBrace) throw new Error('Judge returned invalid JSON.');
  return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

async function runCase(caseData: EvaluationCase, version: string, skipJudge: boolean) {
  const start = performance.now();
  const news: NewsItem = {
    ...caseData.news,
    url: `evaluation://${caseData.id}`,
    source: 'Fixed offline evaluation fixture',
  };
  let actual: GenerateResultItem = {
    id: caseData.id,
    news,
    analysis: {
      marketingSafe: false, riskLevel: 'high', riskReason: '', sensitiveTopic: false, sensitiveType: null,
      opportunity: '', scene: '', consumerNeed: '', productKeyword: [], reason: 'Pipeline has not completed.',
    },
    product: null,
    opportunityEvaluation: null,
    contentStrategy: null,
    platformContents: emptyContent(),
    platformStatuses: emptyStatuses(),
  };
  let error: string | null = null;

  try {
    const analysis: NewsAnalysis = await analyzeNews(news);
    const selected = analysis.productKeyword.length ? matchProducts(analysis.productKeyword, products) : null;
    actual = { ...actual, analysis, product: selected };
    if (analysis.marketingSafe && selected) {
      const sanitized = sanitizeProductForCopy(selected);
      const opportunity = await evaluateMarketingOpportunity({ news, analysis, product: sanitized });
      actual = { ...actual, opportunityEvaluation: opportunity };
      if (opportunity.shouldGenerate) {
        const strategy: ContentStrategy = await planContentStrategy(news, analysis, sanitized, opportunity);
        if (strategyUsesSensitiveHook(analysis, Object.values(strategy).join(' '))) {
          actual = {
            ...actual,
            opportunityEvaluation: {
              ...opportunity,
              productFitScore: Math.min(opportunity.productFitScore, 59),
              fitLevel: 'weak',
              shouldGenerate: false,
              fitReason: 'Content strategy triggered the existing sensitive-topic safety gate.',
            },
          };
        } else {
          actual = { ...actual, contentStrategy: strategy };
          const context = { news, analysis, product: sanitized, opportunityEvaluation: opportunity, contentStrategy: strategy };
          const outcomes = await Promise.allSettled(platforms.map((platform) => generatePlatformContent(platform, context)));
          const content = emptyContent();
          const statuses = emptyStatuses();
          const platformErrors: Partial<Record<PlatformKey, string>> = {};
          outcomes.forEach((outcome, index) => {
            const platform = platforms[index];
            if (outcome.status === 'fulfilled') {
              (content as Record<PlatformKey, unknown>)[platform] = outcome.value;
              statuses[platform] = 'success';
            } else {
              statuses[platform] = 'failed';
              platformErrors[platform] = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
            }
          });
          actual = { ...actual, platformContents: content, platformStatuses: statuses, ...(Object.keys(platformErrors).length ? { platformErrors } : {}) };
        }
      }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    actual = { ...actual, error, platformContents: emptyContent(), platformStatuses: emptyStatuses() };
  }

  const latencyMs = Math.round(performance.now() - start);
  const record: Record<string, unknown> = {
    case: caseData,
    expected: caseData.expected,
    actual,
    machineMetrics: null,
    judgeResult: null,
    latencyMs,
    error,
  };
  if (!skipJudge) {
    try {
      record.judgeResult = await judge(caseData, actual, version);
    } catch (caught) {
      record.judgeError = caught instanceof Error ? caught.message : String(caught);
    }
  }
  record.machineMetrics = evaluateCase(record);
  return record;
}

async function main() {
  await loadNextEnvironment();
  const { version, skipJudge, checkConfig } = parseArgs();
  if (checkConfig) {
    for (const key of ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL']) {
      console.log(`${key}: ${process.env[key]?.trim() ? 'set' : 'missing'}`);
    }
    return;
  }
  const datasetPath = path.resolve('evaluation/dataset/evaluation_v1.json');
  const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8')) as EvaluationCase[];
  if (dataset.length !== 60) throw new Error(`Expected 60 frozen cases; found ${dataset.length}.`);
  if (dataset.some((item) => item.product.syntheticProduct || !products.some((product) => product.sku === item.product.sku))) {
    throw new Error('A fixture has a synthetic or unknown product SKU; inspect the dataset before running.');
  }
  if (!skipJudge) {
    requiredEnv('LLM_BASE_URL'); requiredEnv('LLM_API_KEY'); requiredEnv('LLM_MODEL');
  }

  const records: Record<string, unknown>[] = [];
  for (let index = 0; index < dataset.length; index += 1) {
    const record = await runCase(dataset[index], version, skipJudge);
    record.version = version;
    record.model = process.env.LLM_MODEL ?? null;
    record.promptVersion = process.env.EVALUATION_PROMPT_VERSION ?? 'evaluation-judge-v1';
    records.push(record);
    console.log(`[${index + 1}/${dataset.length}] ${dataset[index].id}: ${record.error ? 'pipeline error' : 'complete'}`);
  }

  const executedAt = new Date().toISOString();
  const summary = summarize(records as never[], { version, datasetVersion: 'evaluation_v1' });
  const raw = {
    datasetVersion: 'evaluation_v1', version, status: 'completed', runId: `${version}-${executedAt.replaceAll(':', '-')}`,
    executedAt, model: process.env.LLM_MODEL ?? null,
    promptVersion: process.env.EVALUATION_PROMPT_VERSION ?? 'evaluation-judge-v1',
    judgeEnabled: !skipJudge, cases: records,
  };
  const versionSlug = version.replace(/[^a-zA-Z0-9._-]/g, '_');
  const baseline = version === 'v1.2.2';
  const resultsDir = path.resolve('evaluation/results');
  await fs.mkdir(resultsDir, { recursive: true });
  const rawFile = baseline ? 'raw_results_v1.json' : `raw_results_${versionSlug}.json`;
  const summaryFile = baseline ? 'summary_v1.json' : `summary_${versionSlug}.json`;
  await fs.writeFile(path.join(resultsDir, rawFile), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(resultsDir, summaryFile), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(resultsDir, `evaluation_results_${versionSlug}.json`), `${JSON.stringify({ ...raw, summary }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(resultsDir, 'badcases.csv'), buildBadcasesCsv(records, version), 'utf8');
  await fs.writeFile(path.resolve('evaluation/backlog/evaluation_backlog.csv'), buildBacklogCsv(records), 'utf8');
  console.log(`Summary: ${path.join(resultsDir, summaryFile)}`);
  console.log(`Release gate: ${summary.releaseGate.pass ? 'PASS' : 'FAIL / INCOMPLETE'}`);
}

await main();
