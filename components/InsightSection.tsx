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
      ? "中风险 · 谨慎营销"
      : "低风险 · 可营销";
  return (
    <section className="card-section insight-section">
      <div className="section-label"><span className="label-icon">✧</span>AI 洞察</div>
      <span className={`risk-badge ${safe ? analysis.riskLevel : "high"}`}><span>{safe && !analysisFailed ? "✓" : "!"}</span>{riskLabel}</span>
      <div className="insight-line"><span>消费需求</span><strong>{analysis.consumerNeed || (analysisFailed ? "分析失败，暂不可用" : "暂未发现明确需求")}</strong></div>
      <div className="insight-line"><span>商品关键词</span><strong>{analysis.productKeyword.join("、") || "暂无"}</strong></div>
      <p className="reason">{analysis.reason}</p>
      {opportunityEvaluation && <div className={`opportunity-summary ${opportunityEvaluation.shouldGenerate ? opportunityEvaluation.fitLevel : "weak"}`}>
        <strong>{opportunityEvaluation.shouldGenerate ? `${opportunityEvaluation.fitLevel === "strong" ? "强" : "中"}关联 · ${opportunityEvaluation.productFitScore}/100` : `关联度较低 · ${opportunityEvaluation.productFitScore}/100`}</strong>
        <span>{opportunityEvaluation.shouldGenerate ? opportunityEvaluation.fitReason : "当前商品与该热点之间缺少自然消费关系，已停止生成营销内容。"}</span>
        <div className="relationship-path" aria-label="热点到商品的关联路径">{opportunityEvaluation.relationshipPath.map((step, index) => <span className="relationship-node" key={`${step}-${index}`}>
          {index > 0 && <span className="relationship-arrow" aria-hidden="true">→</span>}{step}
        </span>)}</div>
      </div>}
      {analysisFailed
        ? <div className="warning-box"><strong>暂无法判断营销安全</strong>系统未能完成新闻分析，因此已暂停商业文案生成。</div>
        : !safe && <div className="warning-box"><strong>不建议商业借势</strong>{analysis.riskReason} 相关商品仅作为潜在需求参考。</div>}
    </section>
  );
}
