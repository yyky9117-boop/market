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
      <InsightSection
        analysis={item.analysis}
        opportunityEvaluation={item.opportunityEvaluation}
        analysisFailed={item.failureType === "analysis"}
      />
      <ProductSection product={item.product} />
      {item.contentStrategy && item.opportunityEvaluation?.shouldGenerate && <details className="strategy-details">
        <summary>为什么这样写？</summary>
        <dl>
          <div><dt>营销角度</dt><dd>{item.contentStrategy.contentAngle}</dd></div>
          <div><dt>目标人群</dt><dd>{item.contentStrategy.audience}</dd></div>
          <div><dt>消费场景</dt><dd>{item.contentStrategy.scene}</dd></div>
          <div><dt>真实需求</dt><dd>{item.contentStrategy.consumerPainPoint}</dd></div>
          <div><dt>商品角色</dt><dd>{item.contentStrategy.productRole}</dd></div>
          <div><dt>关联度</dt><dd>{item.opportunityEvaluation.productFitScore} / 100</dd></div>
        </dl>
      </details>}
      <CopySection
        contents={item.platformContents}
        statuses={item.platformStatuses}
        errors={item.platformErrors}
        safe={item.analysis.marketingSafe}
        productAvailable={Boolean(item.product)}
        failureType={item.failureType}
        opportunityRejected={item.opportunityEvaluation !== null && !item.opportunityEvaluation.shouldGenerate}
      />
      <footer className="card-footer">
        <span className="angle">{item.failureType === "analysis" ? "新闻分析未完成" : item.opportunityEvaluation && !item.opportunityEvaluation.shouldGenerate ? "关联度较低 · 不建议强行借势" : item.analysis.marketingSafe ? "潜在需求参考" : "高风险热点 · 不建议商业借势"}</span>
        <span className="angle">{generatedCount ? `${mode === "llm" ? "LLM" : "Mock"} · ${generatedCount}/3 个平台已生成` : "暂无平台内容"}</span>
      </footer>
    </article>
  );
}
