import { analyzeNews, generatePlatformContent, planContentStrategy } from "@/lib/llm";
import { ModelServiceError } from "@/lib/llmTransport";
import { evaluateMarketingOpportunity, strategyUsesSensitiveHook } from "@/lib/marketingOpportunity";
import { rankProducts } from "@/lib/productMatcher";
import { sanitizeProductForCopy } from "@/lib/productSanitizer";
import type { GenerateResultItem, MarketingOpportunityEvaluation, NewsItem, PlatformKey, Product } from "@/lib/types";

const platforms: PlatformKey[] = ["weibo", "xiaohongshu", "douyin"];

export async function analyzeMarketingNews(news: NewsItem, products: Product[], id: string): Promise<GenerateResultItem> {
  let stage: "analysis" | "opportunity" | "strategy" = "analysis";
  let item: GenerateResultItem = {
    id, news,
    analysis: { marketingSafe: false, riskLevel: "high", riskReason: "安全分析尚未完成，暂停营销生成。", sensitiveTopic: false, sensitiveType: null,
      opportunity: "", scene: "", consumerNeed: "", productKeyword: [], reason: "分析尚未完成。" },
    product: null, opportunityEvaluation: null, contentStrategy: null,
    platformContents: { weibo: null, xiaohongshu: null, douyin: null },
    platformStatuses: { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" },
    executionStatus: "error", decisionStatus: "unknown",
  };
  try {
    const analysis = await analyzeNews(news);
    const candidates = rankProducts(analysis.productKeyword, products, 3);
    item = { ...item, analysis, product: candidates[0] ?? null };
    if (!analysis.marketingSafe || !candidates.length) {
      return { ...item, executionStatus: "success", decisionStatus: "reject" };
    }
    stage = "opportunity";
    let selected = candidates[0];
    let opportunity: MarketingOpportunityEvaluation | null = null;
    item.productCandidatesEvaluated = [];
    // A rejected top lexical match is not proof that every catalogue candidate is unsuitable.
    // Compare at most three; stop at the first candidate that passes the existing threshold.
    for (const candidate of candidates) {
      item.product = candidate;
      const result = await evaluateMarketingOpportunity({ news, analysis, product: sanitizeProductForCopy(candidate) });
      item.productCandidatesEvaluated.push({ sku: candidate.sku, modelScore: result.modelProductFitScore ?? result.productFitScore,
        finalScore: result.productFitScore, shouldGenerate: result.shouldGenerate, guardReasons: result.guardReasons ?? [] });
      if (!opportunity || result.productFitScore > opportunity.productFitScore) { selected = candidate; opportunity = result; }
      if (result.shouldGenerate) { selected = candidate; opportunity = result; break; }
    }
    item = { ...item, product: selected, opportunityEvaluation: opportunity };
    if (!opportunity?.shouldGenerate) return { ...item, executionStatus: "success", decisionStatus: "reject" };

    stage = "strategy";
    const product = sanitizeProductForCopy(selected);
    const strategy = await planContentStrategy(news, analysis, product, opportunity);
    if (strategyUsesSensitiveHook(analysis, Object.values(strategy).join(" "))) {
      return { ...item, executionStatus: "success", decisionStatus: "reject",
        opportunityEvaluation: { ...opportunity, productFitScore: Math.min(opportunity.productFitScore, 59), fitLevel: "weak", shouldGenerate: false,
          fitReason: "内容策略仍依赖敏感健康议题，已停止营销生成。" } };
    }
    item.contentStrategy = strategy;
    const context = { news, analysis, product, opportunityEvaluation: opportunity, contentStrategy: strategy };
    const results = await Promise.allSettled(platforms.map(platform => generatePlatformContent(platform, context)));
    let partial = false;
    results.forEach((result, index) => {
      const platform = platforms[index];
      if (result.status === "fulfilled") {
        (item.platformContents as Record<PlatformKey, unknown>)[platform] = result.value;
        item.platformStatuses[platform] = "success";
      } else {
        partial = true; item.platformStatuses[platform] = "failed";
        item.platformErrors = { ...item.platformErrors, [platform]: result.reason instanceof Error ? result.reason.message : "该平台内容生成失败。" };
      }
    });
    return { ...item, executionStatus: partial ? "partial" : "success", decisionStatus: "generate" };
  } catch (error) {
    return { ...item, error: error instanceof Error ? error.message : "分析暂时无法完成。",
      errorCode: error instanceof ModelServiceError ? error.code : "PIPELINE_ERROR",
      failureType: stage, executionStatus: "error", decisionStatus: "unknown" };
  }
}
