import { evaluateMarketingOpportunityModel } from "@/lib/llm";
import type { MarketingOpportunityEvaluation, NewsAnalysis, NewsItem, SanitizedProduct } from "@/lib/types";

export const FIT_THRESHOLDS = {
  strong: 80,
  medium: 60,
  generate: 60,
  maxRelationshipNodes: 3,
} as const;

const sensitiveTerms = /ADHD|抑郁|焦虑症|心理健康|精神健康|儿童心理|儿童健康|儿童发育|注意力障碍|疾病|诊断|药物|医疗|心理问题|情绪问题/i;
const sensitiveBridgeTerms = /儿童|孩子|学生|学习|开学|亲子|家庭|注意力|心理|疾病|健康|ADHD|抑郁|焦虑/i;

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
  let score = modelResult.productFitScore;
  let fitReason = modelResult.fitReason || "模型没有提供明确的关联理由。";
  const path = modelResult.relationshipPath;
  let forcedWeak = false;

  if (path.length < 2 || path.length > FIT_THRESHOLDS.maxRelationshipNodes) {
    score = Math.min(score, FIT_THRESHOLDS.medium - 1);
    fitReason = path.length > FIT_THRESHOLDS.maxRelationshipNodes
      ? "关联需要经过多个推理环节，营销关系过于间接。"
      : "关联路径信息不足，暂不能确认商品与热点存在自然联系。";
    forcedWeak = true;
  }

  const relationText = `${path.join(" ")} ${fitReason} ${input.analysis.opportunity} ${input.analysis.scene}`;
  const newsIsSensitive = sensitiveTerms.test(`${input.news.title} ${input.news.brief}`);
  if (input.analysis.sensitiveTopic && (sensitiveTerms.test(relationText) ||
    (newsIsSensitive && sensitiveBridgeTerms.test(relationText)))) {
    score = Math.min(score, FIT_THRESHOLDS.medium - 1);
    fitReason = "该关联依赖健康、心理或儿童相关敏感议题，不适合作为普通商品营销入口。";
    forcedWeak = true;
  }

  if (modelResult.shouldGenerate === false && score >= FIT_THRESHOLDS.generate) {
    score = FIT_THRESHOLDS.generate - 1;
    fitReason = `评估器主动停止生成。${fitReason}`;
    forcedWeak = true;
  }

  const fitLevel = levelForScore(score);
  return {
    productFitScore: score,
    fitLevel,
    shouldGenerate: !forcedWeak && score >= FIT_THRESHOLDS.generate,
    fitReason,
    relationshipPath: path.slice(0, 8),
  };
}

export function strategyUsesSensitiveHook(
  analysis: NewsAnalysis,
  strategyText: string,
): boolean {
  if (!analysis.sensitiveTopic) return false;
  const newsIsSensitive = /child|health|mental|medical|心理|儿童|疾病|健康/i.test(`${analysis.sensitiveType ?? ""}`);
  return sensitiveTerms.test(strategyText) ||
    (newsIsSensitive && sensitiveBridgeTerms.test(strategyText));
}
