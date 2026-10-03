import {refreshEvaluationArtifacts} from "@/lib/evaluation-store";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(){
 try{return Response.json({summary:await refreshEvaluationArtifacts()},{headers:{"Cache-Control":"no-store"}});}
 catch(error){console.error("Evaluation snapshot refresh failed",error);return Response.json({error:"阶段报告更新失败，请检查本地文件；已保存的人工记录不受影响。"},{status:500});}
}
