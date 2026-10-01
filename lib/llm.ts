import type { NewsAnalysis, NewsItem, MarketingCopy, SanitizedProduct } from "@/lib/types";
import { buildMarketingCopyPrompt, buildNewsAnalysisPrompt } from "@/lib/prompts";

interface ChatMessage {
  role: "user";
  content: string;
}

function endpointFromBaseUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

function extractJson<T>(content: string): T {
  const unfenced = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? unfenced.slice(firstBrace, lastBrace + 1)
    : unfenced;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    throw new Error("模型返回内容不是有效 JSON。");
  }
}

async function callLLM<T>(prompt: string): Promise<T> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error("模型服务尚未完整配置。");
  }

  const configuredTimeout = Number(process.env.LLM_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 1_000
    ? Math.min(configuredTimeout, 120_000)
    : 30_000;
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];

  let response: Response;
  try {
    response = await fetch(endpointFromBaseUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("模型请求超时，请稍后重试。");
    }
    throw new Error("暂时无法连接模型服务，请检查服务地址和网络。");
  }

  if (!response.ok) {
    // Avoid exposing provider response bodies, which can contain request details.
    throw new Error(`模型服务返回错误（HTTP ${response.status}）。`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("模型服务返回了无法读取的响应。");
  }

  const content =
    typeof payload === "object" && payload !== null && "choices" in payload &&
    Array.isArray(payload.choices) && typeof payload.choices[0] === "object" && payload.choices[0] !== null &&
    "message" in payload.choices[0] && typeof payload.choices[0].message === "object" && payload.choices[0].message !== null &&
    "content" in payload.choices[0].message
      ? payload.choices[0].message.content
      : null;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => typeof part === "object" && part !== null && "text" in part ? String(part.text) : "").join("\n")
      : "";
  if (!text.trim()) throw new Error("模型没有返回可用内容。");
  return extractJson<T>(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function analyzeNews(news: NewsItem): Promise<NewsAnalysis> {
  const result = await callLLM<unknown>(buildNewsAnalysisPrompt(news));
  if (!isRecord(result)) throw new Error("新闻分析结果格式不正确。");
  const { marketingSafe, riskLevel, riskReason, consumerNeed, productKeyword, reason } = result;
  if (typeof marketingSafe !== "boolean" || !["low", "medium", "high"].includes(String(riskLevel))) {
    throw new Error("新闻分析结果缺少有效的安全判断。");
  }
  if ([riskReason, consumerNeed, productKeyword, reason].some((value) => typeof value !== "string")) {
    throw new Error("新闻分析结果字段不完整。");
  }
  return {
    marketingSafe,
    riskLevel: riskLevel as NewsAnalysis["riskLevel"],
    riskReason: riskReason as string,
    consumerNeed: consumerNeed as string,
    productKeyword: productKeyword as string,
    reason: reason as string,
  };
}

export async function generateMarketingCopy(
  news: NewsItem,
  consumerNeed: string,
  product: SanitizedProduct,
): Promise<MarketingCopy> {
  const result = await callLLM<unknown>(buildMarketingCopyPrompt(news, consumerNeed, product));
  if (!isRecord(result)) throw new Error("营销文案结果格式不正确。");
  const { headline, content, marketingAngle, hashtags } = result;
  if (
    typeof headline !== "string" || typeof content !== "string" ||
    typeof marketingAngle !== "string" || !Array.isArray(hashtags) ||
    !hashtags.every((tag) => typeof tag === "string")
  ) {
    throw new Error("营销文案结果字段不完整。");
  }
  return { headline, content, marketingAngle, hashtags };
}
