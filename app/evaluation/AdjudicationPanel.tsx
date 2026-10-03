"use client";
import {useState} from "react";
import type {EvaluationCase} from "@/lib/evaluation-store";
const primaryOptions=["NEWS_UNDERSTANDING","SAFETY_GATE","SENSITIVE_TOPIC","CONSUMER_NEED","PRODUCT_MATCHING","MARKETING_RELEVANCE","CONTENT_STRATEGY","WEIBO_GENERATION","XHS_GENERATION","DOUYIN_GENERATION","HALLUCINATION","INTERNAL_DATA_LEAK","NEWS_SOURCE","ENGINEERING_ERROR","LATENCY","GOLDEN_LABEL_ISSUE","OTHER"];
export default function AdjudicationPanel({item,onSaved}:{item:EvaluationCase;onSaved:()=>Promise<void>}){
 const b=item.benchmark,e=b.adjudicatedExpected,s=b.rootCause.suggestion;
 const [expected,setExpected]=useState(e);
 const [reason,setReason]=useState(item.adjudicationInput.reason??"");
 const [skus,setSkus]=useState(b.acceptableProductSkus?.join(", ")??"");
 const [productReason,setProductReason]=useState(item.adjudicationInput.productReason??"");
 const [primary,setPrimary]=useState(item.adjudicationInput.rootCause?.primary??s?.primary??b.rootCause.primary??"OTHER");
 const [secondary,setSecondary]=useState(item.adjudicationInput.rootCause?.secondary??s?.secondary??b.rootCause.secondary??"");
 const [rootReason,setRootReason]=useState(item.adjudicationInput.rootCause?.reason??s?.reason??"");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function save(adjudication:unknown){
  setBusy(true);setError("");
  try{const r=await fetch("/api/evaluation/adjudicate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({caseId:item.caseId,adjudication})});const data=await r.json();if(!r.ok)throw new Error(data.error);await onSaved();}
  catch(e){setError(e instanceof Error?e.message:"保存失败");}finally{setBusy(false);}
 }
 return <details className="eval-adjudication" open={b.adjudication.status==="pending"}>
  <summary>Golden / 商品 / 归因仲裁 <small>{b.adjudication.status==="pending"?"标签待确认":"可展开"}</small></summary>
  {error&&<p role="alert" className="eval-alert">{error}</p>}
  <div className="eval-adjudication-body"><h3>确认预期标签</h3><p className="eval-muted">只有明确的人工理由才能修改。保留原始预期及修改证据。</p>
   <label>应生成内容<select value={String(expected.shouldGenerate)} onChange={ev=>setExpected({...expected,shouldGenerate:ev.target.value==="true"})}><option value="true">Generate</option><option value="false">Reject</option></select></label>
   <label>关联等级<select value={expected.fitLevel} onChange={ev=>setExpected({...expected,fitLevel:ev.target.value as typeof expected.fitLevel})}>{["strong","medium","weak"].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>营销安全<select value={String(expected.marketingSafe)} onChange={ev=>setExpected({...expected,marketingSafe:ev.target.value==="true"})}><option value="true">安全</option><option value="false">不适合商业化</option></select></label>
   <label>敏感话题<select value={String(expected.sensitiveTopic)} onChange={ev=>setExpected({...expected,sensitiveTopic:ev.target.value==="true"})}><option value="true">是</option><option value="false">否</option></select></label>
   {(["expectedConsumerNeed","expectedRelationshipPath","forbiddenAngles"] as const).map(k=><label key={k}>{k}<textarea rows={2} value={expected[k].join("\n")} onChange={ev=>setExpected({...expected,[k]:ev.target.value.split("\n").map(s=>s.trim()).filter(Boolean)})}/></label>)}
   <label>确认 / 修改理由<textarea value={reason} onChange={ev=>setReason(ev.target.value)} rows={2}/></label>
   <button type="button" disabled={busy||reason.trim().length<5} onClick={()=>void save({expected,reason})}>确认标签并保存证据</button>
   <h3>可接受商品集合</h3><p className="eval-muted">原 SKU：{b.originalProductSku}。每次扩充都需要人工理由。</p>
   <label>可接受 SKU，逗号分隔<input value={skus} onChange={ev=>setSkus(ev.target.value)} placeholder="SKU002, SKU015"/></label>
   <label>商品语义合理性说明<textarea value={productReason} onChange={ev=>setProductReason(ev.target.value)} rows={2}/></label>
   <button type="button" disabled={busy||!skus.trim()||productReason.trim().length<5} onClick={()=>void save({acceptableProductSkus:skus.split(/[,，\s]+/).filter(Boolean),productReason})}>确认商品集合</button>
   {b.humanVerdict.isBadcase&&<><h3>规范化 Root Cause</h3><p className="eval-muted">原人工归因：{b.rootCause.originalPrimary??"未填"} / {b.rootCause.originalSecondary??"未填"}。以下为待确认建议。</p>
    <label>一级归因<select value={primary} onChange={ev=>setPrimary(ev.target.value)}>{primaryOptions.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>二级归因<input value={secondary} onChange={ev=>setSecondary(ev.target.value)}/></label>
    <label>归因依据<textarea value={rootReason} onChange={ev=>setRootReason(ev.target.value)} rows={2}/></label>
    <button type="button" disabled={busy||!secondary||rootReason.trim().length<5} onClick={()=>void save({rootCause:{primary,secondary,reason:rootReason}})}>确认规范化归因</button>
   </>}
  </div>
 </details>;
}
