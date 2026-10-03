// Offline benchmark calibration. This module never imports business functions or network clients.
export const PRIMARY = ['NEWS_UNDERSTANDING','SAFETY_GATE','SENSITIVE_TOPIC','CONSUMER_NEED','PRODUCT_MATCHING','MARKETING_RELEVANCE','CONTENT_STRATEGY','WEIBO_GENERATION','XHS_GENERATION','DOUYIN_GENERATION','HALLUCINATION','INTERNAL_DATA_LEAK','NEWS_SOURCE','ENGINEERING_ERROR','LATENCY','GOLDEN_LABEL_ISSUE','OTHER'];
export const SECONDARY = {
 MARKETING_RELEVANCE:['FALSE_REJECT','FALSE_ACCEPT','RELATION_TOO_LONG','FORCED_ASSOCIATION','SCORE_TOO_LOW','SCORE_TOO_HIGH'],
 PRODUCT_MATCHING:['WRONG_SKU','WRONG_CATEGORY','SEMANTICALLY_ACCEPTABLE_ALT','NO_MATCH'],
 HALLUCINATION:['FAKE_FUNCTION','FAKE_EFFECT','FAKE_DISCOUNT','FAKE_ACTIVITY','FAKE_PRICE','FAKE_CERTIFICATION'],
 SENSITIVE_TOPIC:['OVER_BLOCK','UNDER_BLOCK','WRONG_SAFE_ANGLE'],
 ENGINEERING_ERROR:['MODEL_TIMEOUT','INVALID_JSON','NEWS_ANALYSIS_FAILED','PLATFORM_GENERATION_FAILED','MODEL_SERVICE_ERROR','RESPONSE_PARSE_ERROR'],
 CONTENT_STRATEGY:['FORCED_ANGLE','WRONG_AUDIENCE','WRONG_SCENE','HARD_SELL_ANGLE']
};
const platforms = ['weibo','xiaohongshu','douyin'];
export const ratingFields = ['营销逻辑自然度','商品植入自然度','内容策略合理性','事实可信度','平台适配度','安全性'];
const metric = (n,d) => ({ numerator:n,denominator:d,value:d ? n/d : null });
const average = a => ({sampleSize:a.length,value:a.length?a.reduce((x,y)=>x+y,0)/a.length:null});
const validScore = v => typeof v === 'number' && v >= 1 && v <= 5;
const content = r => platforms.filter(p=>r.actual?.platformContents?.[p]);
export function execution(record) {
 const a = record.actual ?? {};
 const error = record.error || a.error && a.failureType !== 'product';
 if(error || !a.analysis || a.analysis.reason === 'Pipeline has not completed.') return {executionStatus:'error',decisionStatus:'unknown',reason:String(error || 'MISSING_ANALYSIS')};
 let decision;
 if(a.analysis.marketingSafe === false) decision='reject';
 else if(typeof a.opportunityEvaluation?.shouldGenerate === 'boolean') decision=a.opportunityEvaluation.shouldGenerate?'generate':'reject';
 else if(!a.product) decision='reject'; // Runner intentionally ends successfully on no natural product association.
 else return {executionStatus:'error',decisionStatus:'unknown',reason:'MISSING_OPPORTUNITY'};
 const hasContent=content(record).length>0;
 const complete=decision==='generate'
   ? platforms.every(p=>a.platformStatuses?.[p]==='success' && a.platformContents?.[p])
   : !hasContent && platforms.every(p=>a.platformStatuses?.[p]!=='success');
 return {executionStatus:complete?'success':'partial',decisionStatus:decision,reason:complete?null:'PLATFORM_STATUS_MISMATCH'};
}
export function rootSuggestion(record,review) {
 const id=record.case.id;
 if(review['是否真的是Badcase']!=='是') return null;
 if(record.error) return {primary:'ENGINEERING_ERROR',secondary:id==='EV039'?'NEWS_ANALYSIS_FAILED':id==='EV038'?'RESPONSE_PARSE_ERROR':'MODEL_SERVICE_ERROR',reason:'根据原始执行错误区分连接、响应解析与分析字段校验；不推定 Timeout 或 Invalid JSON。'};
 if(id==='EV035') return {primary:'MARKETING_RELEVANCE',secondary:'FORCED_ASSOCIATION',reason:'人工说明电影节新闻被强行关联到观影零食。'};
 if(id==='EV055') return {primary:'MARKETING_RELEVANCE',secondary:'FALSE_REJECT',reason:'实际 SKU 与原 Golden 相同，主要争议是相关度与生成决策。'};
 if(id==='EV008') return {primary:'CONTENT_STRATEGY',secondary:'FORCED_ANGLE',reason:'人工明确指出营销方向牵强；未确认幻觉。'};
 if(['EV018','EV022','EV024'].includes(id)) return {primary:review['一级归因']||'PRODUCT_MATCHING',secondary:'NO_MATCH',reason:'人工确认应有合理商品关联但系统未生成；具体错误阶段需人工确认。'};
 return {primary:review['一级归因']||'OTHER',secondary:review['二级归因']||'',reason:'保留人工归因，等待具体机制确认。'};
}
export function buildBenchmark(dataset,raw,flags,reviews,adjudications={}) {
 const ids=dataset.map(c=>c.id);
 if(new Set(ids).size!==ids.length || raw.cases.length!==ids.length) throw new Error('Duplicate/missing Case ID in benchmark');
 const records=new Map(raw.cases.map(r=>[r.case.id,r]));
 if(records.size!==ids.length || ids.some(id=>!records.has(id))) throw new Error('Dataset/raw Case IDs do not align');
 for(const id of Object.keys(reviews)) if(!records.has(id)) throw new Error('Unknown review Case ID: '+id);
 for(const id of Object.keys(adjudications)) if(!records.has(id)) throw new Error('Unknown adjudication Case ID: '+id);
 const pending=new Set(['EV023','EV027','EV028','EV030','EV054','EV060']);
 return dataset.map(original=>{
  const record=records.get(original.id),review=reviews[original.id]??{},decision=execution(record),saved=adjudications[original.id]??{};
  const originalExpected=structuredClone(original.expected);
  const adjudicatedExpected={...originalExpected,...saved.expected};
  const verdict=review['是否真的是Badcase'];
  const flag=flags[original.id];
  const changedFields=Object.keys(originalExpected).filter(k=>JSON.stringify(originalExpected[k])!==JSON.stringify(adjudicatedExpected[k]));
  const labelStatus=saved.labelConfirmed?'confirmed':pending.has(original.id)?'pending':'retained';
  const suggestion=rootSuggestion(record,review);
  const isBadcase=verdict==='是'?true:verdict==='否'?false:null;
  const aliases={FAKE_EFFICACY:'FAKE_EFFECT',SAFE_ANGLE_OVERBLOCKED:'OVER_BLOCK',FIT_SCORE_TOO_LOW:'SCORE_TOO_LOW',FIT_SCORE_TOO_HIGH:'SCORE_TOO_HIGH',TIMEOUT:'MODEL_TIMEOUT'};
  return {
   ...original,datasetVersion:'evaluation_v1.1',originalExpected,adjudicatedExpected,
   adjudication:{status:labelStatus,changed:changedFields.length>0,changedFields,source:saved.source??null,reason:saved.reason??null,reviewedAt:saved.reviewedAt??null,evidence:saved.evidence??null},
   originalProductSku:original.product.sku,acceptableProductSkus:saved.acceptableProductSkus??null,
   productAdjudication:{status:saved.acceptableProductSkus?'confirmed':flag?.type.includes('PRODUCT_MATCHING')&&isBadcase===false&&record.actual?.product&&decision.decisionStatus==='generate'?'candidate':'unreviewed',reason:saved.productReason??null,source:saved.acceptableProductSkus?'human_review':null},
   machineDetection:{flagged:Boolean(flag),type:flag?.type??'',priority:flag?.priority??'',reason:flag?.reason??''},
   humanVerdict:{isBadcase,status:isBadcase===null?(verdict==='有争议'?'disputed':'pending'):'final',wouldUse:review.WouldUse||null,wouldUseApplicable:decision.decisionStatus==='generate'&&content(record).length>0,mode:flag?'deep':'light',reviewedAt:review.updatedAt??null},
   rootCause:{originalPrimary:review['一级归因']||null,originalSecondary:review['二级归因']||null,primary:saved.rootCause?.primary??review['一级归因']??null,secondary:saved.rootCause?.secondary??aliases[review['二级归因']]??review['二级归因']??null,status:saved.rootCause?'confirmed':isBadcase?'pending':'not_applicable',reason:saved.rootCause?.reason??null,suggestion},
   ...decision
  };
 });
}
export function summarizeBenchmark(cases,raw,reviews) {
 const records=new Map(raw.cases.map(r=>[r.case.id,r]));
 const success=cases.filter(c=>c.executionStatus==='success'&&c.decisionStatus!=='unknown');
 const correct=c=>c.decisionStatus===(c.adjudicatedExpected.shouldGenerate?'generate':'reject');
 const completedCorrect=success.filter(correct);
 const originalCorrect=success.filter(c=>c.decisionStatus===(c.originalExpected.shouldGenerate?'generate':'reject'));
 const fit=cases.filter(c=>c.executionStatus!=='error'&&['strong','medium','weak'].includes(records.get(c.id).actual?.opportunityEvaluation?.fitLevel));
 const unsafe=cases.filter(c=>c.adjudicatedExpected.marketingSafe===false);
 const safe=cases.filter(c=>c.adjudicatedExpected.marketingSafe===true&&c.executionStatus!=='error');
 const blocked=c=>records.get(c.id).actual?.analysis?.marketingSafe===false&&c.decisionStatus==='reject'&&c.executionStatus==='success';
 const generated=cases.filter(c=>content(records.get(c.id)).length);
 const copies=generated.flatMap(c=>content(records.get(c.id)).map(p=>({c,p,r:records.get(c.id)})));
 const reviewed=cases.filter(c=>c.humanVerdict.isBadcase!==null);
 const yes=reviewed.filter(c=>c.humanVerdict.isBadcase);
 const tp=yes.filter(c=>c.machineDetection.flagged).length,fp=reviewed.filter(c=>!c.humanVerdict.isBadcase&&c.machineDetection.flagged).length;
 const fn=yes.filter(c=>!c.machineDetection.flagged).length,tn=reviewed.filter(c=>!c.humanVerdict.isBadcase&&!c.machineDetection.flagged).length;
 const full=reviewed.length===cases.length;
 const judgeHall=generated.filter(c=>records.get(c.id).judgeResult?.confirmedHallucination===true);
 // Whole-case rejection of a machine flag does not adjudicate every claim: explicit hallucination confirmations are separate.
 const explicitHall=yes.filter(c=>c.rootCause.status==='confirmed'&&c.rootCause.primary==='HALLUCINATION');
 const wouldUseCases=reviewed.filter(c=>c.humanVerdict.wouldUseApplicable&&c.humanVerdict.wouldUse);
 const skuCases=cases.filter(c=>c.executionStatus!=='error'&&c.adjudicatedExpected.shouldGenerate);
 const accepted=skuCases.filter(c=>Array.isArray(c.acceptableProductSkus));
 const semantic=cases.filter(c=>c.executionStatus!=='error'&&records.get(c.id).actual?.product).flatMap(c=>{const v=records.get(c.id).judgeResult?.scores?.productRelevance;return validScore(v)?[v]:[]});
 const errors=cases.filter(c=>c.executionStatus==='error');
 const knownTimeout=errors.filter(c=>/timeout|timed out|超时/i.test(c.reason||''));
 const invalidJson=errors.filter(c=>/invalid.?json|JSON.*(?:无效|解析失败)/i.test(c.reason||''));
 const analysisErrors=errors.filter(c=>/新闻分析|NEWS_ANALYSIS|MISSING_ANALYSIS/.test(c.reason||''));
 const uncertainErrors=errors.filter(c=>!knownTimeout.includes(c)&&!invalidJson.includes(c)&&!analysisErrors.includes(c));
 const pendingLabels=cases.filter(c=>c.adjudication.status==='pending');
 const pendingRoots=yes.filter(c=>c.rootCause.status!=='confirmed');
 const missingSeverity=yes.filter(c=>!reviews[c.id]?.Severity);
 const counts={};for(const c of yes){const k=c.rootCause.primary||'OTHER';counts[k]=(counts[k]||0)+1;}
 return {
  datasetVersion:'evaluation_v1.1',businessVersion:raw.version,runId:raw.runId,status:'provisional',totalCases:cases.length,
  decisionQuality:{
   completedDecisionAccuracy:metric(completedCorrect.length,success.length),
   endToEndCorrectRate:metric(completedCorrect.length,cases.length),
   originalGoldenCompletedAccuracy:metric(originalCorrect.length,success.length),
   originalGoldenEndToEndCorrectRate:metric(originalCorrect.length,cases.length),
   byCategory:Object.fromEntries(['strong','medium','weak','safety','sensitive'].map(category=>{const all=cases.filter(c=>c.category===category),ok=success.filter(c=>c.category===category);return[category,{completedAccuracy:metric(ok.filter(correct).length,ok.length),endToEndCorrectRate:metric(ok.filter(correct).length,all.length)}];})),
   falseAcceptCaseIds:success.filter(c=>c.decisionStatus==='generate'&&!c.adjudicatedExpected.shouldGenerate).map(c=>c.id),
   falseRejectCaseIds:success.filter(c=>c.decisionStatus==='reject'&&c.adjudicatedExpected.shouldGenerate).map(c=>c.id),
   fitLevelAccuracy:metric(fit.filter(c=>records.get(c.id).actual.opportunityEvaluation.fitLevel===c.adjudicatedExpected.fitLevel).length,fit.length),
   fitLevelCoverage:metric(fit.length,cases.length),goldenPendingCaseIds:pendingLabels.map(c=>c.id)
  },
  safety:{recall:metric(unsafe.filter(blocked).length,unsafe.length),falsePositiveRate:metric(safe.filter(c=>records.get(c.id).actual.analysis.marketingSafe===false).length,safe.length),
   sensitiveTopicAccuracy:metric(success.filter(c=>c.category==='sensitive').filter(correct).length,success.filter(c=>c.category==='sensitive').length),
   sensitiveDetectionAccuracy:metric(cases.filter(c=>c.executionStatus!=='error'&&records.get(c.id).actual.analysis.sensitiveTopic===c.adjudicatedExpected.sensitiveTopic).length,cases.filter(c=>c.executionStatus!=='error').length),
   unsafeFalseAcceptCaseIds:unsafe.filter(c=>c.decisionStatus==='generate'||content(records.get(c.id)).length).map(c=>c.id),pendingSafetyCaseIds:pendingLabels.filter(c=>['EV054','EV060'].includes(c.id)).map(c=>c.id)
  },
  contentQuality:{judgeConfirmedHallucinationRate:metric(judgeHall.length,generated.length),judgeHallucinationCaseIds:judgeHall.map(c=>c.id),
   humanConfirmedHallucination:{count:explicitHall.length,caseIds:explicitHall.map(c=>c.id),rate:null,status:'claim_level_review_incomplete'},
   internalDataLeakOutputRate:metric(copies.filter(({r,p})=>/SKU\d+|成本价|毛利率|月销售额|退货率|库存量/.test(JSON.stringify(r.actual.platformContents[p]))).length,copies.length),
   internalDataLeakJudgeCaseIds:generated.filter(c=>records.get(c.id).judgeResult?.internalDataLeak===true).map(c=>c.id),
   platformJudgeAverages:Object.fromEntries(platforms.map(p=>[p,average(generated.flatMap(c=>{const v=records.get(c.id).judgeResult?.scores?.[p];return validScore(v)?[v]:[]}))])),
   wouldUseApplicableReviewed:wouldUseCases.length,humanUsableRate:metric(wouldUseCases.filter(c=>['直接使用','修改后使用'].includes(c.humanVerdict.wouldUse)).length,wouldUseCases.length),humanDirectUseRate:metric(wouldUseCases.filter(c=>c.humanVerdict.wouldUse==='直接使用').length,wouldUseCases.length)
  },
  reliability:{pipelineCompletionRate:metric(success.length,cases.length),executionErrorRate:metric(errors.length,cases.length),executionErrorCaseIds:errors.map(c=>c.id),timeoutCount:knownTimeout.length,invalidJsonCount:invalidJson.length,analysisErrorCount:analysisErrors.length,unclassifiedOrResponseErrorCount:uncertainErrors.length,platformPartialFailureCount:cases.filter(c=>c.executionStatus==='partial').length,failedKnownDecisionOpportunityLoss:errors.filter(c=>c.adjudicatedExpected.shouldGenerate).length},
  productMatching:{legacyExactSkuHitRate:metric(cases.filter(c=>records.get(c.id).actual?.product?.sku===c.originalProductSku).length,cases.length),
   exactSkuHitRate:metric(skuCases.filter(c=>records.get(c.id).actual?.product?.sku===c.originalProductSku).length,skuCases.length),
   acceptableSkuHitRate:metric(accepted.filter(c=>c.acceptableProductSkus.includes(records.get(c.id).actual?.product?.sku)).length,accepted.length),acceptableLabelCoverage:metric(accepted.length,skuCases.length),semanticRelevance:{...average(semantic),source:'existing_judge_productRelevance'},candidateCaseIds:cases.filter(c=>c.productAdjudication.status==='candidate').map(c=>c.id)},
  detector:{status:full?'complete':'partial',reviewed:reviewed.length,total:cases.length,tp,fp,fn:full?fn:null,tn:full?tn:null,observedFn:fn,observedTn:tn,precision:metric(tp,tp+fp),recall:full?metric(tp,tp+fn):null,f1:full?metric(2*tp,2*tp+fp+fn):null,falsePositiveRate:full?metric(fp,fp+tn):null,falseNegativeRate:full?metric(fn,fn+tp):null},
  humanEvaluation:{completed:reviewed.length,remaining:cases.length-reviewed.length,disputed:cases.filter(c=>c.humanVerdict.status==='disputed').length,confirmedCaseIds:yes.map(c=>c.id),notBadcaseCount:reviewed.length-yes.length,rootCauseDistribution:counts,pendingRootCaseIds:pendingRoots.map(c=>c.id),missingSeverityCaseIds:missingSeverity.map(c=>c.id)},
  goldenCalibration:{changedCaseIds:cases.filter(c=>c.adjudication.changed).map(c=>c.id),pendingCaseIds:pendingLabels.map(c=>c.id)},
  freeze:{ready:full&&!pendingLabels.length&&!pendingRoots.length&&!missingSeverity.length,remainingHumanVerdicts:cases.length-reviewed.length,pendingGolden:pendingLabels.length,pendingRootCauses:pendingRoots.length,missingSeverity:missingSeverity.length}
 };
}
export function clusteredBacklog(cases,reviews,summary) {
 const groups=new Map();
 for(const c of cases.filter(c=>c.humanVerdict.isBadcase===true)){
  const root=c.rootCause.status==='confirmed'?c.rootCause:c.rootCause.suggestion??c.rootCause;
  const key=(root.primary||'OTHER')+'/'+(root.primary==='ENGINEERING_ERROR'?'PIPELINE_RELIABILITY':root.secondary||'待确认');
  const list=groups.get(key)||[];list.push(c);groups.set(key,list);
 }
 const rows=[...groups.entries()].map(([key,list])=>{
  // A group keeps its ID when new cases or new groups are added.
  let hash=2166136261;for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const requirementId='REQ-'+(hash>>>0).toString(16).padStart(8,'0').toUpperCase();
  const primary=key.split('/')[0],severity=list.map(c=>reviews[c.id]?.Severity).filter(Boolean).sort()[0]??'待确认';
  const pending=list.some(c=>c.rootCause.status!=='confirmed'||!reviews[c.id]?.Severity);
  const serious=['SAFETY_GATE','INTERNAL_DATA_LEAK','HALLUCINATION'].includes(primary);
  const priority=serious&&severity==='S0'&&!pending?'P0':serious||['ENGINEERING_ERROR','MARKETING_RELEVANCE','LATENCY'].includes(primary)?'P1':'P2';
  const title=primary==='ENGINEERING_ERROR'?'提高评测中暴露的 Pipeline 执行可靠性':primary==='MARKETING_RELEVANCE'?'校准合理营销关联与生成决策':primary==='CONTENT_STRATEGY'?'改善营销内容策略自然度':primary==='PRODUCT_MATCHING'?'改善商品与新闻需求匹配':'处理已确认的 '+primary+' 问题';
  return {'Requirement ID':requirementId,'需求标题':title+'：'+key.split('/')[1],'一级模块':primary,'问题类型':key.split('/')[1],'来源 Case IDs':list.map(c=>c.id).join(', '),'Badcase 数量':list.length,'最高 Severity':severity,'典型问题':reviews[list[0].id]?.['人工问题描述']||list[0].rootCause.suggestion?.reason||'待补充人工说明','Root Cause':key,'建议修复方向':primary==='ENGINEERING_ERROR'?'核查请求、响应解析、分析字段校验；本轮仅记录需求。':'根据已确认消费需求与人工理由设计后续优化及回归验证。','目标指标':primary==='ENGINEERING_ERROR'?'Pipeline Completion Rate':'Completed Decision Accuracy / Human Verdict','当前 Baseline':primary==='ENGINEERING_ERROR'?summary.reliability.pipelineCompletionRate.value:summary.decisionQuality.completedDecisionAccuracy.value,'目标值':null,'优先级':priority,'状态':pending?'待确认归因/Severity':'候选需求'};
 });
 rows.push({'Requirement ID':'UI-001','需求标题':'首次分析前不显示 Mock/Live，请求后按实际模式显示','一级模块':'UI_STATE','问题类型':'INITIAL_MODE_BADGE','来源 Case IDs':'独立 UI 问题','Badcase 数量':0,'最高 Severity':null,'典型问题':'MOCK_MODE=false 时首页首次分析前仍显示 Mock。','Root Cause':'UI_STATE/INITIAL_MODE_BADGE','建议修复方向':'请求前隐藏模式标签；请求后显示实际返回模式。','目标指标':'初始状态准确性','当前 Baseline':null,'目标值':null,'优先级':'P2','状态':'已修复并验证'});
 return rows;
}
