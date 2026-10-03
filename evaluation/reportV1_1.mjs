import fs from 'node:fs/promises';
import path from 'node:path';
const percent=m=>m?.value==null?'待确认 / 无有效分母':(m.value*100).toFixed(2)+'% ('+m.numerator+'/'+m.denominator+')';
export async function writeReport(state){
 const {summary:s,cases,backlog}=state;
 const q=s.decisionQuality,h=s.humanEvaluation;
 const text=`# Evaluation v1.1 Baseline

## 1. 版本信息
业务版本：V1.2.2。Dataset：Evaluation v1.1。来源 Run：${state.raw.runId}。
状态：${s.status==='frozen'?'已冻结':'未冻结'}，人工明确结论 ${h.completed}/60，待复核 ${h.remaining} 条。本报告复用已有 Raw Results 与 Judge，不调用 LLM 或新闻 API。

## 2. Golden 校准
已修改 ${s.goldenCalibration.changedCaseIds.length} 条：${s.goldenCalibration.changedCaseIds.join(', ')}。
${cases.filter(c=>c.adjudication.changed).map(c=>'- '+c.id+': '+JSON.stringify(c.originalExpected)+' → '+JSON.stringify(c.adjudicatedExpected)+'。理由：'+c.adjudication.reason).join('\n')}
待仲裁：${s.goldenCalibration.pendingCaseIds.join(', ')||'无'}。非 Badcase 结论不自动确认所有标签；SKU 扩充只接受有理由的人工仲裁。原始文件哈希保存在 manifest_v1.1.json。

## 3. Decision Quality
| 指标 | 原 Golden，修正执行口径 | v1.1 已确认校准 + 保留标签 |
|---|---|---|
| Completed Decision Accuracy | ${percent(q.originalGoldenCompletedAccuracy)} | ${percent(q.completedDecisionAccuracy)} |
| End-to-End Correct Rate | ${percent(q.originalGoldenEndToEndCorrectRate)} | ${percent(q.endToEndCorrectRate)} |

${Object.entries(q.byCategory).map(([k,v])=>'- '+k+': Completed '+percent(v.completedAccuracy)+'；End-to-End '+percent(v.endToEndCorrectRate)).join('\n')}
False Accept：${q.falseAcceptCaseIds.join(', ')||'无'}。
False Reject：${q.falseRejectCaseIds.join(', ')||'无'}。
Fit Level Accuracy：${percent(q.fitLevelAccuracy)}；有效 fitLevel 覆盖率：${percent(q.fitLevelCoverage)}。未产生 fitLevel 的正常拒绝不虚构 weak。
以上是阶段值，尚有标签待仲裁。Decision 正确不等于内容可用。

## 4. Safety
Safety Recall：${percent(s.safety.recall)}。
Safety False Positive Rate：${percent(s.safety.falsePositiveRate)}（排除无有效分析的运行失败）。
Sensitive Case 决策准确率：${percent(s.safety.sensitiveTopicAccuracy)}。
Sensitive 标识准确率：${percent(s.safety.sensitiveDetectionAccuracy)}。
Unsafe False Accept：${s.safety.unsafeFalseAcceptCaseIds.join(', ')||'无'}。
待 Safety 仲裁：${s.safety.pendingSafetyCaseIds.join(', ')||'无'}；Reject 合理不能直接推断 marketingSafe 分类正确。

## 5. Content Quality
历史 Judge Confirmed Hallucination Rate：${percent(s.contentQuality.judgeConfirmedHallucinationRate)}。
历史 Judge 案例：${s.contentQuality.judgeHallucinationCaseIds.join(', ')}。
人工明确确认幻觉：${s.contentQuality.humanConfirmedHallucination.count} 条；claim 级复核未完成，人工幻觉率保持 null，不能解释为不存在幻觉。
Internal Data Leak 扫描：${percent(s.contentQuality.internalDataLeakOutputRate)}；只扫描消费者文案，扫描命中仍需人工确认。
${Object.entries(s.contentQuality.platformJudgeAverages).map(([p,v])=>'- '+p+' Judge 均分：'+(v.value?.toFixed(2)??'无')+'，样本='+v.sampleSize).join('\n')}
已复核、实际生成且填有 WouldUse 的样本可用率：${percent(s.contentQuality.humanUsableRate)}；直接使用率：${percent(s.contentQuality.humanDirectUseRate)}。当前样本存在筛选偏差，不代表全量可用率；空值不补零，Reject/执行失败不混入文案使用率。

## 6. Reliability
Pipeline Completion Rate：${percent(s.reliability.pipelineCompletionRate)}。
Execution Error Rate：${percent(s.reliability.executionErrorRate)}。
执行错误：${s.reliability.executionErrorCaseIds.join(', ')}。
已证实 Timeout=${s.reliability.timeoutCount}；已证实 Invalid JSON=${s.reliability.invalidJsonCount}；Analysis Error=${s.reliability.analysisErrorCount}；其他连接/不可读响应=${s.reliability.unclassifiedOrResponseErrorCount}；Platform Partial Failure=${s.reliability.platformPartialFailureCount}。
EV021 连接失败、EV038 不可读响应、EV039 分析字段不完整。未证实的错误不硬映射为 Timeout 或 Invalid JSON。
执行错误一律 decisionStatus=unknown，不计为正确 Reject。两个原本被误算正确的失败 Reject 使旧原 Golden 的 End-to-End 从48/60修正为46/60，下降3.33个百分点。三条失败共占全量5%；不能假设它们重跑后必然正确。

## 7. Product Matching
历史全量 Exact SKU：${percent(s.productMatching.legacyExactSkuHitRate)}。
有效执行且预期 Generate 的 Exact SKU：${percent(s.productMatching.exactSkuHitRate)}。
人工批准商品集合的 Acceptable SKU：${percent(s.productMatching.acceptableSkuHitRate)}。
商品集合覆盖率：${percent(s.productMatching.acceptableLabelCoverage)}。
已有 Judge Semantic Relevance：${s.productMatching.semanticRelevance.value?.toFixed(2)??'无'}，样本=${s.productMatching.semanticRelevance.sampleSize}。此指标使用 productRelevance；不以商品植入评分代替。
待确认可接受替代 SKU：${s.productMatching.candidateCaseIds.join(', ')}。不能仅凭 Exact SKU 不同认定推荐错误，也不能无理由扩大 Golden 集合。

## 8. Machine Badcase Detector
固定历史机器标记29条，人工确认 TP=${s.detector.tp}、FP=${s.detector.fp}。
Precision：${percent(s.detector.precision)}。
Recall：${percent(s.detector.recall)}；F1：${percent(s.detector.f1)}；FPR：${percent(s.detector.falsePositiveRate)}；FNR：${percent(s.detector.falseNegativeRate)}。
当前已复核非标记案例中的观察 FN=${s.detector.observedFn}、TN=${s.detector.observedTn}；全量未完成时最终 FN/TN 和完整指标保持 null，不能把剩余31条默认为正常。

## 9. Human Evaluation
已明确结论 ${h.completed}/60；确认 Badcase ${h.confirmedCaseIds.length}；非 Badcase ${h.notBadcaseCount}；有争议 ${h.disputed}。
缺 Severity：${h.missingSeverityCaseIds.join(', ')||'无'}。WouldUse 空值及六维评分原样保留。轻量复核不要求六维打分。

## 10. Confirmed Badcases
${cases.filter(c=>c.humanVerdict.isBadcase).map(c=>'- '+c.id+' / '+c.category+' / '+(c.rootCause.primary||'待归因')+' / '+(state.reviews[c.id]?.['人工问题描述']||'人工确认，说明待补充')).join('\n')}

## 11. Root Cause Distribution
当前有效归因（已仲裁采用规范值，未仲裁保留原人工值）：${JSON.stringify(h.rootCauseDistribution)}。
待规范化归因确认：${h.pendingRootCaseIds.join(', ')||'无'}。
规范化建议不覆盖人工原值。EV035 建议 MARKETING_RELEVANCE/FORCED_ASSOCIATION；EV055 同 SKU 的 False Reject 建议检查相关度；EV008 为策略问题，不直接计入幻觉。
当前人工 S0 若不是安全、严重事实错误或内部泄露，不直接生成 P0。

## 12. V1.2.3 Backlog
需求池记录 ${backlog.length} 条（含已修复的独立 UI_STATE）。完整需求池须在全量复核及归因确认后更新。
${backlog.map(r=>'- '+r['Requirement ID']+' '+r['需求标题']+'；'+r['优先级']+'；'+r['状态']+'；Case='+r['来源 Case IDs']).join('\n')}
候选重点：Pipeline Reliability、营销关联与生成决策、内容策略自然度。最终 Top 3 需补完31条后确定。目标值未确认时留空。
冻结条件：${JSON.stringify(s.freeze)}。${s.status==='frozen'?'已建立 evaluation-v1.1-baseline。':'当前不创建 evaluation-v1.1-baseline tag。'}
`;
 await fs.writeFile(path.join(state.root,'reports/evaluation_v1.1_baseline_report.md'),text);
}
