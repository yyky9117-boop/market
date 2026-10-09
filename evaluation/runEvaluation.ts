import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import productData from '../data/products.json' with { type: 'json' };
import { analyzeMarketingNews } from '../lib/marketingPipeline';
import type { GenerateResultItem, NewsItem, Product } from '../lib/types';
import { evaluateCase, summarize } from './machineMetrics.mjs';
import { buildBadcasesCsv, buildBacklogCsv } from './resultArtifacts.mjs';
import { EVALUATION_JUDGE_PROMPT } from './prompts/judgePrompt';
import { loadCalibration } from './ioV1_1.mjs';
import { execution, summarizeBenchmark, type BenchmarkCase, type RawRun } from './benchmarkV1_1.mjs';

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
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf('--version');
  const datasetIndex = args.indexOf('--dataset');
  return {
    version: versionIndex >= 0 ? args[versionIndex + 1] : process.env.EVALUATION_VERSION ?? 'v1.2.2',
    skipJudge: args.includes('--skip-judge') || process.env.EVAL_SKIP_JUDGE === 'true',
    checkConfig: args.includes('--check-config'),
    datasetVersion: datasetIndex >= 0 ? args[datasetIndex + 1] : 'evaluation_v1',
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
    datasetVersion: caseData.datasetVersion ?? 'evaluation_v1',
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
  const actual = await analyzeMarketingNews(news, products, caseData.id);
  const error = actual.executionStatus === 'error' ? actual.error ?? 'Pipeline error' : null;

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
  const { version, skipJudge, checkConfig, datasetVersion } = parseArgs();
  if (checkConfig) {
    for (const key of ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL']) {
      console.log(`${key}: ${process.env[key]?.trim() ? 'set' : 'missing'}`);
    }
    return;
  }
  if(!['evaluation_v1','evaluation_v1.1'].includes(datasetVersion))throw new Error('Unknown evaluation dataset');
  const frozen=datasetVersion==='evaluation_v1.1'?await loadCalibration():null;
  if(frozen&&frozen.summary.status!=='frozen')throw new Error('Evaluation v1.1 must be frozen before running a version comparison.');
  const datasetPath = path.resolve('evaluation/dataset/'+datasetVersion+'.json');
  const sourceDataset = JSON.parse(await fs.readFile(datasetPath, 'utf8')) as EvaluationCase[];
  const dataset=sourceDataset.map(c=>frozen?{...c,expected:(c as unknown as BenchmarkCase).adjudicatedExpected}:c);
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
  const raw = {
    datasetVersion, version, status: 'completed', runId: `${version}-${executedAt.replaceAll(':', '-')}`,
    executedAt, model: process.env.LLM_MODEL ?? null,
    promptVersion: process.env.EVALUATION_PROMPT_VERSION ?? 'evaluation-judge-v1',
    judgeEnabled: !skipJudge, cases: records,
  };
  const summary=frozen?summarizeBenchmark(frozen.cases.map((c,index)=>({
    ...c,...execution(records[index] as unknown as RawRun['cases'][number]),
    humanVerdict:{...c.humanVerdict,isBadcase:null,status:'pending',wouldUse:null,reviewedAt:null},
    rootCause:{...c.rootCause,status:'pending'},
    machineDetection:{...c.machineDetection,flagged:false,type:'',reason:''}
  })),raw as unknown as RawRun,{}):summarize(records as never[],{version,datasetVersion});
  if(frozen&&'detector' in summary)summary.detector.status='not_evaluated_for_new_run';
  const versionSlug = version.replace(/[^a-zA-Z0-9._-]/g, '_');
  const resultsDir = path.resolve('evaluation/results');
  await fs.mkdir(resultsDir, { recursive: true });
  const runSlug=datasetVersion+'_'+versionSlug+'_'+executedAt.replace(/[^0-9TZ]/g,'');
  const rawFile = `raw_results_${runSlug}.json`;
  const summaryFile = `summary_${runSlug}.json`;
  await fs.writeFile(path.join(resultsDir, rawFile), `${JSON.stringify(raw, null, 2)}\n`, {encoding:'utf8',flag:'wx'});
  await fs.writeFile(path.join(resultsDir, summaryFile), `${JSON.stringify(summary, null, 2)}\n`, {encoding:'utf8',flag:'wx'});
  await fs.writeFile(path.join(resultsDir, `evaluation_results_${runSlug}.json`), `${JSON.stringify({ ...raw, summary }, null, 2)}\n`, {encoding:'utf8',flag:'wx'});
  if(!frozen){
   await fs.writeFile(path.join(resultsDir, `badcases_${runSlug}.csv`), buildBadcasesCsv(records, version), {encoding:'utf8',flag:'wx'});
   await fs.writeFile(path.resolve('evaluation/backlog/evaluation_backlog_'+runSlug+'.csv'), buildBacklogCsv(records), {encoding:'utf8',flag:'wx'});
  }
  console.log(`Summary: ${path.join(resultsDir, summaryFile)}`);
  console.log(frozen?'Version comparison saved; human verdicts from the old run were not reused.':`Release gate: ${'releaseGate' in summary && summary.releaseGate.pass ? 'PASS' : 'FAIL / INCOMPLETE'}`);
}

await main();
