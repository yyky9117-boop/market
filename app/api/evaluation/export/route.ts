import { exportCompletedWorkbook } from "@/lib/evaluation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bytes = await exportCompletedWorkbook();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=badcase_human_review_completed.xlsx; filename*=UTF-8''badcase_human_review_completed.xlsx",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Could not export completed review workbook:", error);
    return Response.json({ error: "导出失败，请检查原始工作簿和人工进度。" }, { status: 500 });
  }
}
