import type { NewsItem } from "@/lib/types";

export default function NewsSection({ news }: { news: NewsItem }) {
  return (
    <section className="card-section">
      <div className="section-label"><span className="label-icon">◉</span>热点新闻</div>
      <h3 className="news-title">{news.title}</h3>
      <p className="news-brief">{news.brief}</p>
      <div className="news-meta">
        <span>{news.source}</span>
        {news.url ? <a className="text-link" href={news.url} target="_blank" rel="noreferrer">查看原文 ↗</a> : <span>演示数据</span>}
      </div>
    </section>
  );
}
