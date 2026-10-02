import { getEvaluationCases } from "@/lib/evaluation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cases = await getEvaluationCases();
    return Response.json({ cases }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not read evaluation cases:", error);
    return Response.json({ error: "无法读取人工评测工作簿，请检查文件和工作表列名。" }, { status: 500 });
  }
}
