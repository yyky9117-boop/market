"use client";

interface SearchPanelProps {
  query: string;
  busy: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}

const suggestions = ["国庆旅游", "高温天气", "开学季", "户外露营"];

export default function SearchPanel({ query, busy, onQueryChange, onSubmit }: SearchPanelProps) {
  return (
    <section className="hero">
      <div className="eyebrow"><span aria-hidden="true">✦</span> 从实时热点，到商品营销灵感</div>
      <h1>让每个热点，<span>都成为增长机会</span></h1>
      <p>捕捉热点，发现商品机会，<br className="sm:hidden" />让 AI 完成从热点到营销内容的全过程。</p>
      <form className="search-box" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <input
          aria-label="热点关键词"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索热点，例如：国庆旅游"
          maxLength={80}
        />
        <button type="submit" disabled={busy || !query.trim()}>
          {busy ? <><span className="spinner" />分析中</> : <>开始分析 <span aria-hidden="true">→</span></>}
        </button>
      </form>
      <div className="suggestions">
        <span>试试这些：</span>
        {suggestions.map((item) => (
          <button className="suggestion" key={item} type="button" onClick={() => onQueryChange(item)}>{item}</button>
        ))}
      </div>
    </section>
  );
}
