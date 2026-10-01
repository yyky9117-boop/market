import type { NewsItem } from "@/lib/types";

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function NewsSection({ news }: { news: NewsItem }) {
  const originalAvailable = isWebUrl(news.url);
  const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(news.title)}`;

  return (
    <section className="card-section">
      <div className="section-label"><span className="label-icon">◉</span>热点新闻</div>
      <h3 className="news-title">{news.title}</h3>
      <p className="news-brief">{news.brief}</p>
      <div className="news-meta">
        <span>{news.source}</span>
        <div className="news-actions">
          {originalAvailable && <a className="text-link" href={news.url} target="_blank" rel="noopener noreferrer">查看原文 ↗</a>}
          <a className="text-link" href={searchUrl} target="_blank" rel="noopener noreferrer">搜索该新闻 ↗</a>
        </div>
      </div>
    </section>
  );
}
