import { saveReview } from "@/lib/evaluation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return Response.json({ error: "请求数据格式无效。" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const caseId = typeof record.caseId === "string" ? record.caseId.trim() : "";
    if (!caseId) return Response.json({ error: "缺少 Case ID。" }, { status: 400 });
    const review = await saveReview(caseId, record.review);
    return Response.json({ caseId, review }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存人工评测失败。";
    const status = /unknown Case ID/i.test(message) ? 404 : /must be|Invalid|object/i.test(message) ? 400 : 500;
    if (status === 500) console.error("Could not save evaluation review:", error);
    return Response.json({ error: status === 500 ? "保存失败，请检查本地评测文件权限。" : message }, { status });
  }
}
