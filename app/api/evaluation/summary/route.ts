import { getEvaluationSummary } from "@/lib/evaluation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getEvaluationSummary(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not read evaluation summary:", error);
    return Response.json({ error: "无法读取评测汇总。" }, { status: 500 });
  }
}
