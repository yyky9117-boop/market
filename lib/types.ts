export type RiskLevel = "low" | "medium" | "high";

export interface NewsItem {
  title: string;
  brief: string;
  url: string;
  source: string;
}

export interface NewsAnalysis {
  marketingSafe: boolean;
  riskLevel: RiskLevel;
  riskReason: string;
  sensitiveTopic: boolean;
  sensitiveType: string | null;
  opportunity: string;
  scene: string;
  consumerNeed: string;
  productKeyword: string[];
  reason: string;
}

export type FitLevel = "strong" | "medium" | "weak";

export interface MarketingOpportunityEvaluation {
  productFitScore: number;
  fitLevel: FitLevel;
  shouldGenerate: boolean;
  fitReason: string;
  relationshipPath: string[];
}

export interface ContentStrategy {
  audience: string;
  scene: string;
  consumerPainPoint: string;
  productRole: string;
  contentAngle: string;
  coreMessage: string;
  toneHint: string;
}

export interface SanitizedProduct {
  name: string;
  price: number | null;
  detail: string;
}

export interface Product {
  sku: string;
  category: string;
  subcategory: string;
  name: string;
  price: number | null;
  cost?: number | null;
  margin?: number | null;
  monthlySales?: number | null;
  monthlyRevenue?: number | null;
  returnRate?: number | null;
  stock?: number | null;
  rating: number | null;
  detail: string;
  sourceFields?: Array<{ column: number; header: string; value: unknown }>;
}

export interface WeiboContent {
  title: string;
  content: string;
  hashtags: string[];
}

export interface XiaohongshuContent {
  contentAngle: string;
  title: string;
  hook: string;
  content: string;
  tags: string[];
  coverText: string;
  imagePrompt: string;
}

export interface DouyinScene {
  shot: number;
  visual: string;
  voiceover: string;
}

export interface DouyinContent {
  title: string;
  hook: string;
  scenes: DouyinScene[];
  cta: string;
}

export interface PlatformContentByKey {
  weibo: WeiboContent;
  xiaohongshu: XiaohongshuContent;
  douyin: DouyinContent;
}

export type PlatformKey = keyof PlatformContentByKey;

export type PlatformContents = {
  [K in PlatformKey]: PlatformContentByKey[K] | null;
};

export type PlatformStatus = "loading" | "success" | "failed" | "not_generated";
export type PlatformStatuses = Record<PlatformKey, PlatformStatus>;
export type PlatformErrors = Partial<Record<PlatformKey, string>>;

export interface GenerateResultItem {
  id: string;
  news: NewsItem;
  analysis: NewsAnalysis;
  product: Product | null;
  opportunityEvaluation: MarketingOpportunityEvaluation | null;
  contentStrategy: ContentStrategy | null;
  platformContents: PlatformContents;
  platformStatuses: PlatformStatuses;
  platformErrors?: PlatformErrors;
  error?: string;
  failureType?: "analysis" | "product" | "opportunity" | "strategy";
}

export interface GenerateResponse {
  query: string;
  items: GenerateResultItem[];
  mode: "mock" | "llm";
  newsMode: "mock" | "live";
  warning?: string;
}

export const WORKFLOW_STEPS = [
  "获取热点新闻",
  "理解新闻内容",
  "判断营销风险",
  "分析商品需求",
  "匹配适合商品",
  "评估热点与商品关联",
  "规划统一内容策略",
  "生成多平台内容",
] as const;
