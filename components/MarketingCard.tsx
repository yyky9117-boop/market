import type { GenerateResultItem } from "@/lib/types";
import CopySection from "@/components/CopySection";
import InsightSection from "@/components/InsightSection";
import NewsSection from "@/components/NewsSection";
import ProductSection from "@/components/ProductSection";

export default function MarketingCard({ item, mode }: { item: GenerateResultItem; mode: "mock" | "llm" }) {
  return (
    <article className="marketing-card">
      <NewsSection news={item.news} />
      <InsightSection analysis={item.analysis} analysisFailed={item.failureType === "analysis"} />
      <ProductSection product={item.product} />
      <CopySection copy={item.copy} safe={item.analysis.marketingSafe} error={item.error} failureType={item.failureType} />
      <footer className="card-footer">
        <span className="angle">{item.copy ? `灵感角度：${item.copy.marketingAngle}` : item.failureType === "analysis" ? "新闻分析未完成" : "潜在需求参考"}</span>
        {item.copy && <span className="angle">{mode === "llm" ? "LLM 生成" : "Mock 文案"}</span>}
      </footer>
    </article>
  );
}
