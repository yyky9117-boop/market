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
  const isDemoNews = news.source.startsWith("Mock 演示");
  const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(news.title)}`;

  return (
    <section className="card-section">
      <div className="section-label"><span className="label-icon">01</span>新闻事实</div>
      <h3 className="news-title">{news.title}</h3>
      <p className="news-brief">{news.brief}</p>
      <div className="news-meta">
        <span>{news.source}</span>
        <div className="news-actions">
          {originalAvailable && <a className="text-link" href={news.url} target="_blank" rel="noopener noreferrer" title="来源页面可能变动或失效">打开来源 ↗</a>}
          {!isDemoNews && <a className="text-link" href={searchUrl} target="_blank" rel="noopener noreferrer">标题搜索 ↗</a>}
          {isDemoNews && <span className="demo-source-note">演示新闻无原文链接</span>}
        </div>
      </div>
    </section>
  );
}
