import type { GenerateResultItem } from "@/lib/types";
import CopySection from "@/components/CopySection";
import InsightSection from "@/components/InsightSection";
import NewsSection from "@/components/NewsSection";
import ProductSection from "@/components/ProductSection";

export default function MarketingCard({ item, mode }: { item: GenerateResultItem; mode: "mock" | "llm" }) {
  const generatedCount = Object.values(item.platformStatuses).filter((status) => status === "success").length;
  return (
    <article className="marketing-card">
      <NewsSection news={item.news} />
      <InsightSection analysis={item.analysis} analysisFailed={item.failureType === "analysis"} />
      <ProductSection product={item.product} />
      <CopySection
        contents={item.platformContents}
        statuses={item.platformStatuses}
        errors={item.platformErrors}
        safe={item.analysis.marketingSafe}
        productAvailable={Boolean(item.product)}
        failureType={item.failureType}
      />
      <footer className="card-footer">
        <span className="angle">{item.failureType === "analysis" ? "新闻分析未完成" : item.analysis.marketingSafe ? "潜在需求参考" : "高风险热点 · 不建议商业借势"}</span>
        <span className="angle">{generatedCount ? `${mode === "llm" ? "LLM" : "Mock"} · ${generatedCount}/3 个平台已生成` : "暂无平台内容"}</span>
      </footer>
    </article>
  );
}
