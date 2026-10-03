export default function Header({ mode, newsMode, busy }: { mode: "mock" | "llm" | null; newsMode: "mock" | "live"; busy: boolean }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">✳</span>
        <span>热点增长台</span>
      </div>
      <div className="topbar-right">
        <span>AI 电商营销工作台</span>
        {(busy || mode !== null) && <span className={`mock-pill${busy ? " loading-pill" : ""}`} aria-live="polite">
          <i className={busy ? "loading-dot" : "mock-dot"} />
          {busy ? "AI 正在分析" : mode === "mock" ? "Mock 演示模式" : newsMode === "live" ? "LLM + 实时新闻" : "LLM 已接入 · 新闻 Mock"}
        </span>}
      </div>
    </header>
  );
}
