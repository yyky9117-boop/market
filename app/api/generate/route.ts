import { NextResponse } from "next/server";
import { getMockResults } from "@/data/mockResults";
import productData from "@/data/products.json";
import { analyzeMarketingNews } from "@/lib/marketingPipeline";
import { searchNews } from "@/lib/news";
import type { GenerateResponse, Product } from "@/lib/types";

export const runtime = "nodejs";
const products = productData as Product[];

function isLLMConfigured(): boolean {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const query = typeof body === "object" && body !== null && "query" in body
      ? String(body.query).trim()
      : "";
    if (!query) return NextResponse.json({ error: "请输入一个热点关键词。" }, { status: 400 });

    const mockMode = process.env.MOCK_MODE?.toLowerCase() === "true" || !isLLMConfigured();
    const response: GenerateResponse = mockMode
      ? { query, items: getMockResults(query), mode: "mock", newsMode: "mock" }
      : await (async () => {
          const news = await searchNews(query);
          return {
            query,
            items: await Promise.all(news.items.map((item, index) => analyzeMarketingNews(item, products, String(index + 1)))),
            mode: "llm" as const,
            newsMode: news.mode,
            warning: news.warning,
          };
        })();
    if (response.items.length === 0) {
      return NextResponse.json({ error: "暂时没有找到相关热点内容，请换一个关键词试试。" }, { status: 502 });
    }
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "暂时无法完成分析，请稍后再试。" }, { status: 500 });
  }
}
