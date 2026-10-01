import { NextResponse } from "next/server";
import { getMockResults } from "@/data/mockResults";
import productData from "@/data/products.json";
import { analyzeNews, generatePlatformContent } from "@/lib/llm";
import { matchProducts } from "@/lib/productMatcher";
import { searchNews } from "@/lib/news";
import { sanitizeProductForCopy } from "@/lib/productSanitizer";
import type {
  GenerateResponse,
  GenerateResultItem,
  NewsAnalysis,
  NewsItem,
  PlatformContentByKey,
  PlatformContents,
  PlatformErrors,
  PlatformStatuses,
  Product,
} from "@/lib/types";

export const runtime = "nodejs";

const products = productData as Product[];

function emptyPlatformContents(): PlatformContents {
  return { weibo: null, xiaohongshu: null, douyin: null };
}

function ungeneratedPlatformStatuses(): PlatformStatuses {
  return { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" };
}

function platformOutcome<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled"
    ? { status: "success" as const, content: result.value }
    : { status: "failed" as const, content: null, error: "该平台内容生成失败，请稍后重试。" };
}

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

async function analyzeItem(news: NewsItem, index: number): Promise<GenerateResultItem> {
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
      platformContents: emptyPlatformContents(),
      platformStatuses: ungeneratedPlatformStatuses(),
      error: "新闻分析失败，无法安全生成文案。",
      failureType: "analysis" as const,
    };
  }

  const product = analysis.productKeyword
    ? matchProducts(analysis.productKeyword, products)
    : null;

  // Continue to show potential needs and matched products, but never call the copy model on an unsafe story.
  if (!analysis.marketingSafe) {
    return {
      id: String(index + 1), news, analysis, product,
      platformContents: emptyPlatformContents(),
      platformStatuses: ungeneratedPlatformStatuses(),
    };
  }

  if (!product) {
    return {
      id: String(index + 1),
      news,
      analysis,
      product: null,
      platformContents: emptyPlatformContents(),
      platformStatuses: ungeneratedPlatformStatuses(),
      error: analysis.productKeyword
        ? "没有匹配到合适商品，已跳过文案生成。"
        : "没有发现自然的商品关联，已跳过文案生成。",
      failureType: "product" as const,
    };
  }

  try {
    const context = { news, analysis, product: sanitizeProductForCopy(product) };
    const [weiboResult, xiaohongshuResult, douyinResult] = await Promise.allSettled([
      generatePlatformContent("weibo", context),
      generatePlatformContent("xiaohongshu", context),
      generatePlatformContent("douyin", context),
    ]);
    const weibo = platformOutcome<PlatformContentByKey["weibo"]>(weiboResult);
    const xiaohongshu = platformOutcome<PlatformContentByKey["xiaohongshu"]>(xiaohongshuResult);
    const douyin = platformOutcome<PlatformContentByKey["douyin"]>(douyinResult);
    const platformErrors: PlatformErrors = {};
    if (weibo.status === "failed") {
      console.error("Weibo content generation failed:", weiboResult.status === "rejected" ? weiboResult.reason : "unknown");
      platformErrors.weibo = weibo.error;
    }
    if (xiaohongshu.status === "failed") {
      console.error("Xiaohongshu content generation failed:", xiaohongshuResult.status === "rejected" ? xiaohongshuResult.reason : "unknown");
      platformErrors.xiaohongshu = xiaohongshu.error;
    }
    if (douyin.status === "failed") {
      console.error("Douyin content generation failed:", douyinResult.status === "rejected" ? douyinResult.reason : "unknown");
      platformErrors.douyin = douyin.error;
    }
    return {
      id: String(index + 1),
      news,
      analysis,
      product,
      platformContents: {
        weibo: weibo.content,
        xiaohongshu: xiaohongshu.content,
        douyin: douyin.content,
      },
      platformStatuses: {
        weibo: weibo.status,
        xiaohongshu: xiaohongshu.status,
        douyin: douyin.status,
      },
      ...(Object.keys(platformErrors).length > 0 ? { platformErrors } : {}),
    };
  } catch (error) {
    console.error("Platform content generation setup failed:", error);
    return {
      id: String(index + 1),
      news,
      analysis,
      product,
      platformContents: emptyPlatformContents(),
      platformStatuses: { weibo: "failed", xiaohongshu: "failed", douyin: "failed" },
      platformErrors: {
        weibo: "微博内容生成失败，请稍后重试。",
        xiaohongshu: "小红书内容生成失败，请稍后重试。",
        douyin: "短视频脚本生成失败，请稍后重试。",
      },
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
