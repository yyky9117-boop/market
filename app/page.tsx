"use client";

import { useRef, useState } from "react";
import Header from "@/components/Header";
import MarketingCard from "@/components/MarketingCard";
import SearchPanel from "@/components/SearchPanel";
import WorkflowProgress from "@/components/WorkflowProgress";
import type { GenerateResponse } from "@/lib/types";
import { WORKFLOW_STEPS } from "@/lib/types";

const examples = ["国庆旅游", "高温天气", "开学季", "新能源汽车", "户外露营"];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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

  return (
    <div className="app-shell">
      <Header mode={result?.mode ?? null} newsMode={result?.newsMode ?? "mock"} busy={busy} />
      <main className="main">
        <SearchPanel query={query} busy={busy} onQueryChange={setQuery} onSubmit={generate} />
        <WorkflowProgress activeStep={activeStep} visible={busy || Boolean(result)} />
        {error && <div className="error-banner" role="alert">{error}</div>}

        {result ? <section className="results" aria-live="polite">
          <div className="results-head">
            <div>
              <div className="results-title"><h2>热点分析结果</h2><span className="count">{result.items.length} 条新闻</span></div>
              <p className="results-subtitle">围绕「{result.query}」整理出的热点、需求与商品灵感</p>
            </div>
            <span className="sort-label">分析模式：<strong>{result.mode === "mock" ? "Mock 演示" : result.newsMode === "live" ? "真实 LLM · 实时新闻" : "真实 LLM · Mock 新闻"}</strong></span>
          </div>
          {result.warning && <div className="warning-banner" role="status">{result.warning}</div>}
          <div className="card-grid">{result.items.map((item) => <MarketingCard key={item.id} item={item} mode={result.mode} />)}</div>
        </section> : !busy && !error ? <section className="empty-state">
          <div className="empty-graphic" aria-hidden="true">⌕</div>
          <strong>从一个热点，开始发现商品机会</strong>
          输入你关注的话题，AI 将逐步分析消费需求并生成营销灵感。
          <div className="hashtags" style={{ justifyContent: "center", marginTop: 15 }}>{examples.map((item) => <button className="suggestion" key={item} type="button" onClick={() => setQuery(item)}>{item}</button>)}</div>
        </section> : null}

        <p className="footer-note">AI 生成内容仅供创意参考，请结合实际商品信息审核后使用。</p>
      </main>
    </div>
  );
}
