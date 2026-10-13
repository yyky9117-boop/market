import type { GenerateResultItem } from "@/lib/types";
import CopySection from "@/components/CopySection";
import InsightSection from "@/components/InsightSection";
import NewsSection from "@/components/NewsSection";
import ProductSection from "@/components/ProductSection";

export default function MarketingCard({ item, mode }: { item: GenerateResultItem; mode: "mock" | "llm" }) {
  const generatedCount = Object.values(item.platformStatuses).filter((status) => status === "success").length;
  const rejected = !item.analysis.marketingSafe || !item.product || item.opportunityEvaluation?.shouldGenerate === false;
  const failedStage = item.failureType === "analysis" ? "新闻分析失败" : item.failureType === "opportunity" ? "商品关联评估失败" : "内容策略规划失败";
  return (
    <article className="marketing-card">
      <header className="case-detail-head">
        <div><span>OPPORTUNITY BRIEF / {String(item.id).padStart(2, "0")}</span><h3>热点机会拆解</h3></div>
        <span className={`detail-decision ${item.executionStatus === "error" ? "error" : rejected ? "stopped" : "ready"}`}>
          {item.executionStatus === "error" ? "分析未完成" : rejected ? "已停止商业内容" : generatedCount > 0 ? "可生成内容" : "内容未生成"}
        </span>
      </header>
      {item.executionStatus === "error" && <div className="case-error-banner" role="alert"><strong>{failedStage}</strong><span>{item.error || "本条新闻暂时无法完成分析，请稍后重试。"}</span></div>}
      <div className="case-detail-body">
        <div className="decision-column">
          <NewsSection news={item.news} />
          <InsightSection
            analysis={item.analysis}
            opportunityEvaluation={item.opportunityEvaluation}
            analysisFailed={item.failureType === "analysis"}
          />
          <ProductSection product={item.product} analysisFailed={item.failureType === "analysis"} />
        </div>
        <div className="creation-column">
          {item.contentStrategy && item.opportunityEvaluation?.shouldGenerate && <section className="strategy-panel" aria-label="统一内容策略">
            <div className="section-label"><span className="label-icon">04</span>统一内容策略</div>
            <p className="strategy-angle">{item.contentStrategy.contentAngle}</p>
            <p className="strategy-message">{item.contentStrategy.coreMessage}</p>
            <details className="strategy-details">
              <summary>查看完整策略依据</summary>
              <dl>
                <div><dt>目标人群</dt><dd>{item.contentStrategy.audience}</dd></div>
                <div><dt>具体场景</dt><dd>{item.contentStrategy.scene}</dd></div>
                <div><dt>真实需求</dt><dd>{item.contentStrategy.consumerPainPoint}</dd></div>
                <div><dt>商品角色</dt><dd>{item.contentStrategy.productRole}</dd></div>
                <div><dt>表达语气</dt><dd>{item.contentStrategy.toneHint}</dd></div>
              </dl>
            </details>
          </section>}
          <CopySection
            contents={item.platformContents}
            statuses={item.platformStatuses}
            errors={item.platformErrors}
            safe={item.analysis.marketingSafe}
            productAvailable={Boolean(item.product)}
            failureType={item.failureType}
            opportunityRejected={item.opportunityEvaluation !== null && !item.opportunityEvaluation.shouldGenerate}
          />
        </div>
      </div>
      <footer className="card-footer">
        <span className="angle">{item.failureType === "analysis" ? "新闻分析未完成" : item.opportunityEvaluation && !item.opportunityEvaluation.shouldGenerate ? "关联不足，保留判断理由" : item.analysis.marketingSafe ? "内容需结合商品实际信息审核" : "高风险热点，不建议商业借势"}</span>
        <span className="angle">{generatedCount ? `${mode === "llm" ? "真实模型" : "演示样例"} · ${generatedCount}/3 平台` : "暂无平台内容"}</span>
      </footer>
    </article>
  );
}
