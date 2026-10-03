import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {atomicJson,readJson,importHuman,loadCalibration,sha,withFileLock,refreshWorkbookCopies} from './ioV1_1.mjs';
import {writeReport} from './reportV1_1.mjs';
const root=path.resolve(process.env.EVALUATION_DATA_DIR||'evaluation');
async function main(){
const mode=process.argv.includes('--freeze')?'freeze':process.argv.includes('--init')?'init':'refresh';
const sources=['dataset/evaluation_v1.json','results/raw_results_v1.json','results/summary_v1.json','human/badcase_human_review_completed.xlsx'];
const hashes=Object.fromEntries(await Promise.all(sources.map(async f=>[f,sha(await fs.readFile(path.join(root,f)))])));
const manifestPath=path.join(root,'manifest_v1.1.json');
let manifest=await readJson(manifestPath,null);
if(manifest?.frozenAt)throw new Error('Evaluation v1.1 is frozen. Create a new benchmark version for label changes.');
if(manifest)for(const f of sources)if(manifest.sourceHashes[f]!==hashes[f])throw new Error('Historical source changed: '+f);
if(mode==='init'){
 if(!manifest){
  const imported=await importHuman(root),progress=await readJson(path.join(root,'review-progress.json'),{});
  for(const [id,review]of Object.entries(imported.reviews)){
   const saved=progress[id]??{};
   for(const [field,v]of Object.entries(review))if(field in saved&&String(saved[field]??'')!==String(v??''))throw new Error('Excel/progress conflict: '+id+' '+field);
   imported.reviews[id]={...review,...saved};
  }
  await atomicJson(path.join(root,'human/review_import_v1.1.json'),imported);
  await atomicJson(path.join(root,'human/adjudications_v1.1.json'),{
   EV020:{expected:{shouldGenerate:false,fitLevel:'weak'},labelConfirmed:true,source:'human_review',reason:'人工明确说明铁路轻装出行与500ml家庭装沐浴露的关系牵强，系统 Reject 更合理。',evidence:'Badcase人工复核 / EV020 / 人工问题描述',reviewedAt:imported.reviews.EV020.updatedAt??null},
   EV025:{expected:{shouldGenerate:false,fitLevel:'weak'},labelConfirmed:true,source:'human_review',reason:'用户明确确认该新闻没有合理可关联商品，系统 Reject 正确，不是 Badcase。',evidence:'用户对 EV025 的明确仲裁；Excel最终结论=否',reviewedAt:imported.reviews.EV025.updatedAt??null}
  });
  manifest={datasetVersion:'evaluation_v1.1',businessVersion:'v1.2.2',sourceHashes:hashes,checkpointCommit:execFileSync('git',['rev-parse','evaluation-v1.0-complete'],{encoding:'utf8'}).trim(),sourceRunId:(await readJson(path.join(root,'results/raw_results_v1.json'))).runId,createdAt:new Date().toISOString(),frozenAt:null};
  await atomicJson(manifestPath,manifest);
 }
}
if(!manifest)throw new Error('Run pnpm eval:calibrate -- --init first.');
const state=await loadCalibration(root);
if(mode==='freeze'){
 if(!state.summary.freeze.ready)throw new Error('Baseline is incomplete: '+JSON.stringify(state.summary.freeze));
 const changes=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
 if(changes)throw new Error('Commit verified evaluation changes before freezing.');
 const tags=execFileSync('git',['tag','--list','evaluation-v1.1-baseline'],{encoding:'utf8'}).trim();
 if(tags)throw new Error('Baseline tag already exists.');
 state.summary.status='frozen';
}
await atomicJson(path.join(root,'dataset/evaluation_v1.1.json'),state.cases);
await atomicJson(path.join(root,'results/evaluation_results_v1.1.json'),{datasetVersion:'evaluation_v1.1',sourceRunId:state.raw.runId,cases:state.cases.map(c=>({caseId:c.id,executionStatus:c.executionStatus,decisionStatus:c.decisionStatus,errorReason:c.reason,adjudicatedExpected:c.adjudicatedExpected,actual:state.raw.cases.find(r=>r.case.id===c.id).actual,machineDetection:c.machineDetection,humanVerdict:c.humanVerdict,rootCause:c.rootCause})),summary:state.summary});
await atomicJson(path.join(root,'results/summary_v1.1.json'),state.summary);
await atomicJson(path.join(root,'human/human_verdicts_v1.1.json'),Object.fromEntries(state.cases.map(c=>[c.id,{...c.humanVerdict,answers:state.reviews[c.id]??{}}])));
await refreshWorkbookCopies(state);
if(mode==='freeze'){
 manifest.frozenAt=new Date().toISOString();state.summary.status='frozen';
 await writeReport(state);
 manifest.frozenHashes=Object.fromEntries(await Promise.all(['dataset/evaluation_v1.1.json','human/adjudications_v1.1.json','human/human_verdicts_v1.1.json','human/review_import_v1.1.json','backlog/v1.2.3_backlog.xlsx'].map(async f=>[f,sha(await fs.readFile(path.join(root,f)))])));
 await atomicJson(manifestPath,manifest);
 await atomicJson(path.join(root,'results/summary_v1.1.json'),state.summary);
 execFileSync('git',['add','--','evaluation/dataset/evaluation_v1.1.json','evaluation/results/evaluation_results_v1.1.json','evaluation/results/summary_v1.1.json','evaluation/human/human_verdicts_v1.1.json','evaluation/reports/evaluation_v1.1_baseline_report.md','evaluation/manifest_v1.1.json','evaluation/backlog/v1.2.3_backlog.xlsx']);
 execFileSync('git',['commit','-m','chore: freeze evaluation v1.1 baseline']);
 execFileSync('git',['tag','evaluation-v1.1-baseline']);
}else await writeReport(state);
console.log(JSON.stringify({mode,progress:state.summary.humanEvaluation,decision:state.summary.decisionQuality,freeze:state.summary.freeze},null,2));
}
if(process.env.EVALUATION_WRITE_LOCK_HELD==='true')await main();
else await withFileLock(root,main);
