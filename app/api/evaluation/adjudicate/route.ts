import {saveAdjudication} from "@/lib/evaluation-store";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{const body=await request.json();if(typeof body?.caseId!=="string")return Response.json({error:"缺少 Case ID"},{status:400});const adjudication=await saveAdjudication(body.caseId,body.adjudication);return Response.json({adjudication},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const message=error instanceof Error?error.message:"仲裁保存失败";return Response.json({error:message},{status:/Invalid|must be|Unknown/.test(message)?400:500});}
}
