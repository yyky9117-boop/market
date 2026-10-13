"use client";

interface SearchPanelProps {
  query: string;
  busy: boolean;
  compact: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}

const suggestions = ["国庆旅游", "高温天气", "开学季", "户外露营", "新能源汽车"];

export default function SearchPanel({ query, busy, compact, onQueryChange, onSubmit }: SearchPanelProps) {
  return (
    <section className={`hero${compact ? " compact" : ""}`}>
      <div className="eyebrow"><span aria-hidden="true">✦</span> AI COMMERCE INTELLIGENCE / 热点营销工作台</div>
      <h1>热点背后，<span>先找到值得写的机会。</span></h1>
      <p>从新闻事实出发，验证需求与商品的关系，再生成真正适合平台的内容。</p>
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
      {!compact && <div className="suggestions">
        <span>试试这些：</span>
        {suggestions.map((item) => (
          <button className="suggestion" key={item} type="button" onClick={() => onQueryChange(item)}>{item}</button>
        ))}
      </div>}
    </section>
  );
}
