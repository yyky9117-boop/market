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
  consumerNeed: string;
  productKeyword: string;
  reason: string;
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

export interface MarketingCopy {
  headline: string;
  content: string;
  marketingAngle: string;
  hashtags: string[];
}

export interface GenerateResultItem {
  id: string;
  news: NewsItem;
  analysis: NewsAnalysis;
  product: Product | null;
  copy: MarketingCopy | null;
  error?: string;
  failureType?: "analysis" | "product" | "copy";
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
  "生成营销文案",
] as const;
