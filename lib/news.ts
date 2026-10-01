import { getMockResults } from "@/data/mockResults";
import type { NewsItem } from "@/lib/types";

export interface NewsSearchResult {
  items: NewsItem[];
  mode: "mock" | "live";
  warning?: string;
}

interface TavilyResult {
  title?: unknown;
  content?: unknown;
  url?: unknown;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

const DEFAULT_NEWS_API_URL = "https://api.tavily.com/search";

function mockNews(query: string): NewsItem[] {
  return getMockResults(query).map(({ news }) => news);
}

function isWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeResults(results: TavilyResult[] | undefined): NewsItem[] {
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();

  return results.flatMap((result) => {
    if (typeof result.title !== "string" || !result.title.trim() || !isWebUrl(result.url)) return [];
    const url = new URL(result.url);
    if (seen.has(url.href)) return [];
    seen.add(url.href);

    const brief = typeof result.content === "string" ? result.content.trim() : "";
    return [{
      title: result.title.trim().slice(0, 300),
      brief: brief.slice(0, 3000),
      url: url.href,
      source: url.hostname.replace(/^www\./, ""),
    }];
  }).slice(0, 3);
}

/** Tavily is the default adapter; NEWS_API_URL lets the provider be replaced without changing callers. */
export async function searchNews(query: string): Promise<NewsSearchResult> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return {
      items: mockNews(query),
      mode: "mock",
      warning: "尚未配置新闻搜索 API Key，当前使用演示新闻。",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.NEWS_TIMEOUT_MS) || 20000);

  try {
    const response = await fetch(process.env.NEWS_API_URL || DEFAULT_NEWS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        topic: "news",
        search_depth: "basic",
        max_results: 3,
        include_answer: false,
        include_raw_content: false,
        time_range: "week",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`News API returned ${response.status}`);
    const data = await response.json() as TavilyResponse;
    const items = normalizeResults(data.results);
    if (items.length === 0) throw new Error("News API returned no usable results");
    return { items, mode: "live" };
  } catch (error) {
    console.error("News search failed; falling back to mock results:", error);
    return {
      items: mockNews(query),
      mode: "mock",
      warning: "实时新闻搜索暂时不可用，当前使用演示新闻继续分析。",
    };
  } finally {
    clearTimeout(timeout);
  }
}
