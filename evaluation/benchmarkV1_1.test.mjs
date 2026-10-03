import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildBenchmark,summarizeBenchmark,execution,clusteredBacklog} from './benchmarkV1_1.mjs';
import {loadCalibration,sha} from './ioV1_1.mjs';

test('historical inputs and all Case IDs remain unchanged',async()=>{
 const state=await loadCalibration();
 const manifest=JSON.parse(await fs.readFile('evaluation/manifest_v1.1.json'));
 for(const [file,hash]of Object.entries(manifest.sourceHashes))
  assert.equal(sha(await fs.readFile('evaluation/'+file)),hash);
 assert.equal(state.cases.length,60);
 assert.equal(new Set(state.cases.map(c=>c.id)).size,60);
 for(const c of state.cases)assert.deepEqual(c.originalExpected,c.expected);
 assert.equal(Object.keys(state.imported.reviews).length,29);
 assert.equal(state.imported.reviews.EV025['是否真的是Badcase'],'否');
 assert.equal(state.imported.reviews.EV025.Severity,null);
});
test('approved alternatives have explicit coverage, and clustered IDs survive new groups',async()=>{
 const s=await loadCalibration();
 const chosen=s.raw.cases.find(r=>r.case.id==='EV006').actual.product.sku;
 const saved={...s.adjudications,EV006:{acceptableProductSkus:[chosen],productReason:'Synthetic test approval, never saved to the real benchmark.'}};
 const cases=buildBenchmark(s.dataset,s.raw,s.imported.flags,s.imported.reviews,saved);
 const summary=summarizeBenchmark(cases,s.raw,s.imported.reviews);
 assert.equal(summary.productMatching.acceptableSkuHitRate.numerator,1);
 assert.equal(summary.productMatching.acceptableSkuHitRate.denominator,1);
 assert.equal(summary.productMatching.acceptableLabelCoverage.numerator,1);
 const before=clusteredBacklog(cases,s.imported.reviews,summary);
 assert.equal(before.find(r=>r['一级模块']==='ENGINEERING_ERROR')['Badcase 数量'],3);
 const changed=structuredClone(cases);const extra=changed.find(c=>c.id==='EV001');
 extra.humanVerdict.isBadcase=true;extra.rootCause={...extra.rootCause,primary:'OTHER',secondary:'NEW_GROUP',status:'confirmed'};
 const after=clusteredBacklog(changed,s.imported.reviews,summary);
 for(const row of before)assert.equal(after.find(r=>r['Root Cause']===row['Root Cause'])['Requirement ID'],row['Requirement ID']);
});
test('failed refusals stay unknown, successful no-product and safety refusals are valid',async()=>{
 const s=await loadCalibration();
 for(const id of ['EV021','EV038','EV039'])assert.deepEqual(
  [s.cases.find(c=>c.id===id).executionStatus,s.cases.find(c=>c.id===id).decisionStatus],['error','unknown']);
 const noProduct=s.raw.cases.find(r=>r.case.id==='EV031');
 assert.equal(execution(noProduct).executionStatus,'success');
 assert.equal(execution(noProduct).decisionStatus,'reject');
 const partial=structuredClone(s.raw.cases.find(r=>r.case.id==='EV001'));
 partial.actual.platformStatuses.weibo='failed';
 assert.equal(execution(partial).executionStatus,'partial');
 assert.equal(execution(partial).decisionStatus,'generate');
});
test('unreviewed cases do not become true negatives or completed detector statistics',async()=>{
 const s=await loadCalibration();
 const reviews=structuredClone(s.imported.reviews);
 const c=buildBenchmark(s.dataset,s.raw,s.imported.flags,reviews,s.adjudications);
 const summary=summarizeBenchmark(c,s.raw,reviews);
 assert.equal(summary.detector.tp,9);assert.equal(summary.detector.fp,20);
 assert.equal(summary.detector.recall,null);assert.equal(summary.detector.f1,null);
 assert.equal(summary.detector.tn,null);
 for(const item of s.dataset)if(!reviews[item.id])reviews[item.id]={'是否真的是Badcase':item.id==='EV001'?'是':'否'};
 const full=summarizeBenchmark(buildBenchmark(s.dataset,s.raw,s.imported.flags,reviews,s.adjudications),s.raw,reviews);
 assert.equal(full.detector.fn,1);assert.equal(full.detector.tn,30);
 assert.equal(full.detector.recall.value,0.9);
 assert.equal(full.detector.f1.value,18/39);
 reviews.EV005['是否真的是Badcase']='有争议';
 const disputed=summarizeBenchmark(buildBenchmark(s.dataset,s.raw,s.imported.flags,reviews,s.adjudications),s.raw,reviews);
 assert.equal(disputed.detector.recall,null);
 assert.equal(disputed.humanEvaluation.disputed,1);
});
test('adjudication requires explicit saved labels; a no-Badcase verdict does not copy predictions',async()=>{
 const s=await loadCalibration();
 const c=buildBenchmark(s.dataset,s.raw,s.imported.flags,s.imported.reviews,{});
 const ev=c.find(c=>c.id==='EV025');
 assert.equal(ev.adjudicatedExpected.shouldGenerate,true);
 const summary=summarizeBenchmark(c,s.raw,s.imported.reviews);
 assert.equal(summary.decisionQuality.completedDecisionAccuracy.numerator,46);
 assert.equal(summary.decisionQuality.completedDecisionAccuracy.denominator,57);
 assert.equal(summary.decisionQuality.endToEndCorrectRate.denominator,60);
 assert.equal(summary.productMatching.acceptableSkuHitRate.value,null);
 assert.equal(summary.contentQuality.humanConfirmedHallucination.rate,null);
 assert.throws(()=>buildBenchmark([...s.dataset,s.dataset[0]],s.raw,s.imported.flags,s.imported.reviews),/Duplicate/);
});
