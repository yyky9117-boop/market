"use client";

import { useRef, useState } from "react";
import Header from "@/components/Header";
import MarketingCard from "@/components/MarketingCard";
import SearchPanel from "@/components/SearchPanel";
import WorkflowProgress from "@/components/WorkflowProgress";
import type { GenerateResponse, GenerateResultItem } from "@/lib/types";
import { WORKFLOW_STEPS } from "@/lib/types";

function caseState(item: GenerateResultItem): { label: string; tone: string } {
  if (item.executionStatus === "error") return { label: "分析未完成", tone: "error" };
  if (!item.analysis.marketingSafe) return { label: "高风险 · 已停止", tone: "stopped" };
  if (!item.product) return { label: "暂无适合商品", tone: "stopped" };
  if (item.opportunityEvaluation && !item.opportunityEvaluation.shouldGenerate) {
    return { label: "弱关联 · 已停止", tone: "stopped" };
  }
  const count = Object.values(item.platformStatuses).filter((status) => status === "success").length;
  return count > 0 ? { label: `${count} 个平台可用`, tone: "ready" } : { label: "内容未生成", tone: "error" };
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const runId = useRef(0);

  async function generate() {
    const cleanQuery = query.trim();
    if (!cleanQuery || busy) return;
    const currentRun = ++runId.current;
    setBusy(true);
    setError("");
    setResult(null);
    setActiveStep(0);
    let failed = false;

    const progress = (async () => {
      for (let step = 1; step < WORKFLOW_STEPS.length; step += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 620));
        if (runId.current === currentRun && !failed) setActiveStep(step);
      }
    })();

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanQuery }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "这次没有分析成功，请稍后重试。");
      await progress;
      if (runId.current === currentRun) {
        setResult(data as GenerateResponse);
        setSelectedIndex(0);
        setActiveStep(WORKFLOW_STEPS.length);
      }
    } catch (caught) {
      if (runId.current === currentRun) {
        failed = true;
        setError(caught instanceof Error ? caught.message : "网络暂时开小差了，请稍后重试。");
        setActiveStep(-1);
      }
    } finally {
      if (runId.current === currentRun) setBusy(false);
    }
  }

  const readyCount = result?.items.filter((item) => Object.values(item.platformStatuses).some((status) => status === "success")).length ?? 0;
  const errorCount = result?.items.filter((item) => item.executionStatus === "error").length ?? 0;
  const stoppedCount = (result?.items.length ?? 0) - readyCount - errorCount;
  const selectedItem = result?.items[selectedIndex] ?? result?.items[0];

  return (
    <div className="app-shell">
      <Header mode={result?.mode ?? null} newsMode={result?.newsMode ?? "mock"} busy={busy} />
      <main className="main">
        <SearchPanel query={query} busy={busy} compact={Boolean(result) && !busy} onQueryChange={setQuery} onSubmit={generate} />
        <WorkflowProgress activeStep={activeStep} visible={busy || Boolean(result)} />
        {error && <div className="error-banner" role="alert">{error}</div>}

        {result ? <section className="results" aria-live="polite">
          <div className="results-head">
            <div>
              <div className="results-kicker">ANALYSIS REPORT / 热点机会</div>
              <div className="results-title"><h2>「{result.query}」分析报告</h2><span className="count">{result.items.length} 条新闻</span></div>
              <p className="results-subtitle">逐条判断新闻是否适合营销，再决定商品与内容方向。</p>
            </div>
            <span className="sort-label">数据来源 <strong>{result.mode === "mock" ? "Mock 演示" : result.newsMode === "live" ? "真实模型 · 实时搜索" : "真实模型 · 演示新闻"}</strong></span>
          </div>
          {result.warning && <div className="warning-banner" role="status">{result.warning}</div>}
          <div className="result-overview" aria-label="本次分析概览">
            <div className="overview-stat"><span>新闻样本</span><strong>{result.items.length.toString().padStart(2, "0")}</strong><small>逐条独立判断</small></div>
            <div className="overview-stat ready"><span>可用内容</span><strong>{readyCount.toString().padStart(2, "0")}</strong><small>至少一个平台生成成功</small></div>
            <div className="overview-stat"><span>谨慎停止</span><strong>{stoppedCount.toString().padStart(2, "0")}</strong><small>风险、弱关联或无商品</small></div>
            <div className="overview-stat"><span>分析异常</span><strong>{errorCount.toString().padStart(2, "0")}</strong><small>单条失败不影响其他新闻</small></div>
          </div>
          <div className="result-workspace">
            <aside className="case-rail" aria-label="新闻分析列表">
              <div className="case-rail-head"><span>热点列表</span><span>{result.items.length} ITEMS</span></div>
              <div className="case-list">
                {result.items.map((item, index) => {
                  const state = caseState(item);
                  return <button
                    className={`case-item${selectedItem?.id === item.id ? " selected" : ""}`}
                    type="button"
                    key={item.id}
                    aria-pressed={selectedItem?.id === item.id}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <span className="case-item-top"><span>NEWS {String(index + 1).padStart(2, "0")}</span><span className={`case-state ${state.tone}`}>{state.label}</span></span>
                    <strong>{item.news.title}</strong>
                    <span className="case-item-meta">{item.analysis.consumerNeed || "暂无明确消费需求"}</span>
                  </button>;
                })}
              </div>
              <p className="case-rail-note">点击热点查看完整判断链路。关联分数为模型估计，并非销售预测。</p>
            </aside>
            {selectedItem && <MarketingCard key={selectedItem.id} item={selectedItem} mode={result.mode} />}
          </div>
        </section> : !busy && !error ? <section className="empty-state">
          <div className="empty-heading"><span>HOW IT WORKS</span><strong>从新闻事实走到可用内容</strong><p>先判断是否值得写，再决定怎么写。每一步都有可查看的依据。</p></div>
          <div className="empty-steps">
            <div><span>01 / DISCOVER</span><strong>发现热点</strong><p>搜索相关新闻，保留标题、摘要和来源。</p></div>
            <div><span>02 / DECIDE</span><strong>判断机会</strong><p>核对消费需求、商品关联和营销风险。</p></div>
            <div><span>03 / CREATE</span><strong>生成内容</strong><p>共用内容策略，分别写成三种平台形式。</p></div>
          </div>
        </section> : null}

        <p className="footer-note">AI 生成内容仅供创意参考，请结合实际商品信息审核后使用。</p>
      </main>
    </div>
  );
}
