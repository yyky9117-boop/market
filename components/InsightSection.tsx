import type { MarketingOpportunityEvaluation, NewsAnalysis } from "@/lib/types";

export default function InsightSection({
  analysis,
  opportunityEvaluation,
  analysisFailed = false,
}: {
  analysis: NewsAnalysis;
  opportunityEvaluation: MarketingOpportunityEvaluation | null;
  analysisFailed?: boolean;
}) {
  const safe = analysis.marketingSafe;
  const riskLabel = analysisFailed
    ? "分析失败 · 文案已暂停"
    : !safe
    ? "高风险热点"
    : analysis.riskLevel === "medium"
      ? "安全风险中等"
      : "安全风险较低";
  const fitLabel = opportunityEvaluation?.fitLevel === "strong" ? "强关联" : opportunityEvaluation?.fitLevel === "medium" ? "中关联" : "弱关联";
  return (
    <section className="card-section insight-section">
      <div className="section-label"><span className="label-icon">02</span>消费需求与营销判断</div>
      <span className={`risk-badge ${safe ? analysis.riskLevel : "high"}`}><span>{safe && !analysisFailed ? "✓" : "!"}</span>{riskLabel}</span>
      <div className="insight-facts">
        <div><span>消费需求</span><strong>{analysis.consumerNeed || (analysisFailed ? "分析失败，暂不可用" : "暂未发现明确需求")}</strong></div>
        <div><span>商品检索词</span><strong>{analysis.productKeyword.join("、") || "暂无"}</strong></div>
      </div>
      <p className="reason">{analysis.reason}</p>
      {opportunityEvaluation && <div className={`opportunity-summary ${opportunityEvaluation.shouldGenerate ? opportunityEvaluation.fitLevel : "weak"}`}>
        <div className="fit-top"><div><span>营销关联度 · 模型估计</span><strong>{opportunityEvaluation.productFitScore}<small>/100</small></strong></div><span className="fit-level">{fitLabel}</span></div>
        <progress className="fit-progress" value={opportunityEvaluation.productFitScore} max={100} aria-label="营销关联分数" />
        <p className="fit-reason">{opportunityEvaluation.fitReason}</p>
        {opportunityEvaluation.relationshipPath.length > 0 && <div className="relationship-block"><span>关联路径</span><div className="relationship-path" aria-label="热点到商品的关联路径">{opportunityEvaluation.relationshipPath.map((step, index) => <span className="relationship-node" key={`${step}-${index}`}>
          {index > 0 && <span className="relationship-arrow" aria-hidden="true">→</span>}{step}
        </span>)}</div></div>}
        {Boolean(opportunityEvaluation.newsEvidence?.length) && <div className="evidence-block"><span>新闻依据</span><p>{opportunityEvaluation.newsEvidence?.map((piece) => `「${piece}」`).join(" ")}</p></div>}
      </div>}
      {analysisFailed
        ? <div className="warning-box"><strong>暂无法判断营销安全</strong>系统未能完成新闻分析，因此已暂停商业文案生成。</div>
        : !safe && <div className="warning-box"><strong>不建议商业借势</strong>{analysis.riskReason} 相关商品仅作为潜在需求参考。</div>}
    </section>
  );
}
