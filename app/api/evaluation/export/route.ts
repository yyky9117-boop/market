import {exportCompletedWorkbook} from "@/lib/evaluation-store";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request){
 try{const full=new URL(request.url).searchParams.get("mode")==="full";const bytes=await exportCompletedWorkbook(full?"full":"deep");const filename=full?"full_human_review_completed.xlsx":"badcase_human_review_completed.xlsx";
 return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename="+filename,"Cache-Control":"no-store"}});
 }catch(error){console.error("Could not export evaluation workbook",error);return Response.json({error:"导出失败，请检查原始工作簿及 Case ID。"}, {status:500});}
}
