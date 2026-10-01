import { NextResponse } from "next/server";
import { getMockResults } from "@/data/mockResults";
import productData from "@/data/products.json";
import { analyzeNews, generateMarketingCopy } from "@/lib/llm";
import { matchProducts } from "@/lib/productMatcher";
import { searchNews } from "@/lib/news";
import { sanitizeProductForCopy } from "@/lib/productSanitizer";
import type { GenerateResponse, NewsAnalysis, NewsItem, Product } from "@/lib/types";

export const runtime = "nodejs";

const products = productData as Product[];

function isLLMConfigured(): boolean {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
}

function failedAnalysis(): NewsAnalysis {
  return {
    marketingSafe: false,
    riskLevel: "high",
    riskReason: "新闻安全分析未完成，系统已暂停营销文案生成。",
    consumerNeed: "",
    productKeyword: "",
    reason: "分析服务暂时不可用。",
  };
}

async function analyzeItem(news: NewsItem, index: number) {
  let analysis: NewsAnalysis;
  try {
    analysis = await analyzeNews(news);
  } catch (error) {
    console.error("News analysis failed:", error);
    return {
      id: String(index + 1),
      news,
      analysis: failedAnalysis(),
      product: null,
      copy: null,
      error: "新闻分析失败，无法安全生成文案。",
      failureType: "analysis" as const,
    };
  }

  const product = analysis.productKeyword
    ? matchProducts(analysis.productKeyword, products)
    : null;

  // Continue to show potential needs and matched products, but never call the copy model on an unsafe story.
  if (!analysis.marketingSafe) {
    return { id: String(index + 1), news, analysis, product, copy: null };
  }

  if (!product) {
    return {
      id: String(index + 1),
      news,
      analysis,
      product: null,
      copy: null,
      error: analysis.productKeyword
        ? "没有匹配到合适商品，已跳过文案生成。"
        : "没有发现自然的商品关联，已跳过文案生成。",
      failureType: "product" as const,
    };
  }

  try {
    const safeProduct = sanitizeProductForCopy(product);
    const copy = await generateMarketingCopy(news, analysis.consumerNeed, safeProduct);
    return { id: String(index + 1), news, analysis, product, copy };
  } catch (error) {
    console.error("Marketing copy generation failed:", error);
    return {
      id: String(index + 1),
      news,
      analysis,
      product,
      copy: null,
      error: "文案生成暂时失败，请稍后重新分析。",
      failureType: "copy" as const,
    };
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const query =
      typeof body === "object" && body !== null && "query" in body
        ? String(body.query).trim()
        : "";

    if (!query) {
      return NextResponse.json({ error: "请输入一个热点关键词。" }, { status: 400 });
    }

    const mockMode = process.env.MOCK_MODE?.toLowerCase() === "true" || !isLLMConfigured();
    const response: GenerateResponse = mockMode
      ? { query, items: getMockResults(query), mode: "mock", newsMode: "mock" }
      : await (async () => {
          const news = await searchNews(query);
          return {
            query,
            items: await Promise.all(news.items.map(analyzeItem)),
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
    return NextResponse.json(
      { error: "暂时无法完成分析，请稍后再试。" },
      { status: 500 },
    );
  }
}
