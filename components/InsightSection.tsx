import type { NewsAnalysis } from "@/lib/types";

export default function InsightSection({ analysis, analysisFailed = false }: { analysis: NewsAnalysis; analysisFailed?: boolean }) {
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
      <div className="insight-line"><span>商品关键词</span><strong>{analysis.productKeyword || "暂无"}</strong></div>
      <p className="reason">{analysis.reason}</p>
      {analysisFailed
        ? <div className="warning-box"><strong>暂无法判断营销安全</strong>系统未能完成新闻分析，因此已暂停商业文案生成。</div>
        : !safe && <div className="warning-box"><strong>不建议商业借势</strong>{analysis.riskReason} 相关商品仅作为潜在需求参考。</div>}
    </section>
  );
}
