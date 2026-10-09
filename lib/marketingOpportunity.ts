import { evaluateMarketingOpportunityModel } from "@/lib/llm";
import { usesSensitiveMarketingHook } from "@/lib/contentGrounding";
import type { MarketingOpportunityEvaluation, NewsAnalysis, NewsItem, SanitizedProduct } from "@/lib/types";

export const FIT_THRESHOLDS = {
  strong: 80,
  medium: 60,
  generate: 60,
  maxRelationshipNodes: 3,
} as const;

function levelForScore(score: number): MarketingOpportunityEvaluation["fitLevel"] {
  if (score >= FIT_THRESHOLDS.strong) return "strong";
  if (score >= FIT_THRESHOLDS.medium) return "medium";
  return "weak";
}

export async function evaluateMarketingOpportunity(input: {
  news: NewsItem;
  analysis: NewsAnalysis;
  product: SanitizedProduct;
}): Promise<MarketingOpportunityEvaluation> {
  const modelResult = await evaluateMarketingOpportunityModel(input.news, input.analysis, input.product);
  return applyOpportunityGuards(input, modelResult);
}

export function applyOpportunityGuards(input: {
  news: NewsItem; analysis: NewsAnalysis; product: SanitizedProduct;
}, modelResult: MarketingOpportunityEvaluation): MarketingOpportunityEvaluation {
  let score = modelResult.productFitScore;
  let fitReason = modelResult.fitReason || "模型没有提供明确的关联理由。";
  const path = modelResult.relationshipPath;
  let forcedWeak = false;
  const guardReasons: string[] = [];

  if (path.length < 2 || path.length > FIT_THRESHOLDS.maxRelationshipNodes) {
    score = Math.min(score, FIT_THRESHOLDS.medium - 1);
    fitReason = path.length > FIT_THRESHOLDS.maxRelationshipNodes
      ? "关联需要经过多个推理环节，营销关系过于间接。"
      : "关联路径信息不足，暂不能确认商品与热点存在自然联系。";
    forcedWeak = true;
    guardReasons.push("INVALID_RELATIONSHIP_LENGTH");
  }

  const relationText = `${path.slice(1).join(" ")} ${input.analysis.consumerNeed} ${input.analysis.scene}`;
  if (!input.analysis.marketingSafe) {
    score = 0; forcedWeak = true; fitReason = "该新闻不适合商业营销，已停止生成。";
    guardReasons.push("UNSAFE_NEWS");
  } else if (input.analysis.sensitiveTopic && usesSensitiveMarketingHook(relationText)) {
    score = Math.min(score, FIT_THRESHOLDS.medium - 1);
    fitReason = "该关联依赖健康、心理或儿童相关敏感议题，不适合作为普通商品营销入口。";
    forcedWeak = true;
    guardReasons.push("SENSITIVE_MARKETING_HOOK");
  }

  const source = `${input.news.title} ${input.news.brief}`;
  const evidence = modelResult.newsEvidence ?? [];
  if (modelResult.requiresInventedScene === true || !evidence.length ||
    evidence.some(fragment => fragment.trim().length < 2 || !source.includes(fragment.trim()))) {
    score = Math.min(score, FIT_THRESHOLDS.medium - 1);
    forcedWeak = true;
    guardReasons.push("MISSING_OR_INVENTED_NEWS_EVIDENCE");
    fitReason = "缺少新闻原文支持的消费场景，或关联依赖新增场景，暂不生成营销内容。";
  }

  if (modelResult.shouldGenerate === false && score >= FIT_THRESHOLDS.generate) {
    score = FIT_THRESHOLDS.generate - 1;
    fitReason = `评估器主动停止生成。${fitReason}`;
    forcedWeak = true;
    guardReasons.push("MODEL_REJECTED");
  }

  const fitLevel = levelForScore(score);
  return {
    productFitScore: score,
    fitLevel,
    shouldGenerate: !forcedWeak && score >= FIT_THRESHOLDS.generate,
    fitReason,
    relationshipPath: path.slice(0, 8),
    newsEvidence: evidence,
    requiresInventedScene: modelResult.requiresInventedScene,
    modelProductFitScore: modelResult.productFitScore,
    guardReasons,
  };
}

export function strategyUsesSensitiveHook(
  analysis: NewsAnalysis,
  strategyText: string,
): boolean {
  if (!analysis.sensitiveTopic) return false;
  return usesSensitiveMarketingHook(strategyText);
}
