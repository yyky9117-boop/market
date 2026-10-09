export class ModelServiceError extends Error {
  code: string;
  retryable: boolean;
  attempts: number;
  retryAfterMs: number;

  constructor(code: string, message: string, retryable = false, attempts = 1, retryAfterMs = 0) {
    super(message);
    this.name = "ModelServiceError";
    this.code = code;
    this.retryable = retryable;
    this.attempts = attempts;
    this.retryAfterMs = retryAfterMs;
  }
}

let active = 0;
const waiting: Array<{ start: () => void }> = [];

function numberOption(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return value && Number.isFinite(number) ? Math.min(max, Math.max(min, Math.floor(number))) : fallback;
}

export function modelDeadline(): number {
  return Date.now() + numberOption(process.env.LLM_TIMEOUT_MS, 30_000, 1_000, 120_000);
}

async function acquire(deadline: number): Promise<() => void> {
  const limit = numberOption(process.env.LLM_MAX_CONCURRENCY, 3, 1, 8);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new ModelServiceError("LLM_TIMEOUT", "模型请求超时，请稍后重试。");
  if (active >= limit) await new Promise<void>((resolve, reject) => {
    const entry = { start: () => { clearTimeout(timer); resolve(); } };
    const timer = setTimeout(() => {
      const index = waiting.indexOf(entry);
      if (index >= 0) waiting.splice(index, 1);
      reject(new ModelServiceError("LLM_TIMEOUT", "模型请求排队超时，请稍后重试。"));
    }, remaining);
    waiting.push(entry);
  });
  else active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = waiting.shift();
    if (next) next.start();
    else active -= 1;
  };
}

function parseModelJson(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = unfenced.indexOf("{"), last = unfenced.lastIndexOf("}");
  try { return JSON.parse(first >= 0 && last > first ? unfenced.slice(first, last + 1) : unfenced); }
  catch { throw new ModelServiceError("LLM_INVALID_JSON", "模型返回内容不是有效 JSON。", true); }
}

export async function requestModelJson(prompt: string, deadline = modelDeadline()): Promise<unknown> {
  const { LLM_BASE_URL: baseUrl, LLM_API_KEY: key, LLM_MODEL: model } = process.env;
  if (!baseUrl || !key || !model) throw new ModelServiceError("LLM_CONFIG_ERROR", "模型服务尚未完整配置。");
  const base = baseUrl.trim().replace(/\/+$/, "");
  const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  try {
    if (!["http:", "https:"].includes(new URL(endpoint).protocol)) throw new Error();
  } catch { throw new ModelServiceError("LLM_CONFIG_ERROR", "模型服务地址格式不正确。"); }
  const retries = numberOption(process.env.LLM_MAX_RETRIES, 1, 0, 2);
  for (let attempt = 0; ; attempt += 1) {
    const release = await acquire(deadline);
    let failure: ModelServiceError | undefined;
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ModelServiceError("LLM_TIMEOUT", "模型请求超时，请稍后重试。");
      const signal = AbortSignal.timeout(remaining);
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.3, stream: false }),
          signal, cache: "no-store",
        });
      } catch {
        throw new ModelServiceError(signal.aborted ? "LLM_TIMEOUT" : "LLM_CONNECTION_ERROR",
          signal.aborted ? "模型请求超时，请稍后重试。" : "暂时无法连接模型服务，请检查服务地址和网络。", !signal.aborted);
      }
      if (!response.ok) {
        const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        const retryHeader = response.headers.get("retry-after");
        const retryAfterMs = retryHeader ? (Number.isFinite(Number(retryHeader)) ? Number(retryHeader) * 1000 : Date.parse(retryHeader) - Date.now()) : 0;
        await response.body?.cancel().catch(() => {});
        throw new ModelServiceError("LLM_HTTP_ERROR", `模型服务返回错误（HTTP ${response.status}）。`, retryable, attempt + 1, Math.max(0, retryAfterMs || 0));
      }
      let payload: unknown;
      try { payload = await response.json(); }
      catch {
        throw new ModelServiceError(signal.aborted ? "LLM_TIMEOUT" : "LLM_RESPONSE_ERROR",
          signal.aborted ? "模型请求超时，请稍后重试。" : "模型服务返回了无法读取的响应。", !signal.aborted);
      }
      const choice = typeof payload === "object" && payload !== null && "choices" in payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
      const content = choice?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content)
        ? content.map(part => typeof part === "object" && part !== null && "text" in part ? String(part.text) : "").join("\n") : "";
      if (!text.trim()) throw new ModelServiceError("LLM_EMPTY_RESPONSE", "模型没有返回可用内容。", true);
      return parseModelJson(text);
    } catch (error) {
      failure = error instanceof ModelServiceError ? error : new ModelServiceError("LLM_RESPONSE_ERROR", "模型响应处理失败。");
      failure.attempts = attempt + 1;
    } finally { release(); }
    if (!failure.retryable || attempt >= retries) throw failure;
    const waitMs = Math.max(200 * (attempt + 1), failure.retryAfterMs);
    if (Date.now() + waitMs >= deadline) throw failure;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}
