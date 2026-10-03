import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PRIMARY,SECONDARY,ratingFields,type BenchmarkCase,type AdjudicationInput } from "../evaluation/benchmarkV1_1.mjs";
import { loadCalibration,readJson,atomicJson,displayCase,type Calibration } from "../evaluation/ioV1_1.mjs";

export const REVIEW_FIELDS = [
  "是否真的是Badcase",
  "营销逻辑自然度",
  "商品植入自然度",
  "内容策略合理性",
  "事实可信度",
  "平台适配度",
  "安全性",
  "WouldUse",
  "一级归因",
  "二级归因",
  "Severity",
  "人工问题描述",
  "建议修复方向",
  "是否进入需求池",
  "备注",
] as const;

export type ReviewField = (typeof REVIEW_FIELDS)[number];
export type ReviewValue = string | number | null;
export type ReviewAnswers = Partial<Record<ReviewField, ReviewValue>>;

export interface SavedReview extends ReviewAnswers {
  updatedAt?: string;
}


export interface EvaluationCase {
 caseId:string;testType:string;newsTitle:string;newsSummary:string;matchedProduct:string;goldenExpected:string;actualResult:string;
 relationshipPath:string;contentStrategy:string;weibo:string;xiaohongshu:string;shortVideo:string;machineBadcaseType:string;machineJudgeReason:string;machinePriority:string;
 reviewStatus:"未评测"|"已评测"|"有争议";machineSuggestedPrimary:string;machineSuggestedSecondary:string;review:ReviewAnswers;
 machineFlagged:boolean;benchmark:BenchmarkCase;adjudicationInput:AdjudicationInput;hasGeneratedContent:boolean;
}
export interface ReviewProgress {[caseId:string]:SavedReview}
const evaluationDir=process.env.EVALUATION_DATA_DIR?path.resolve(process.env.EVALUATION_DATA_DIR):path.join(process.cwd(),"evaluation");
const workbookPath=path.join(evaluationDir,"human/badcase_human_review.xlsx");
const progressPath=path.join(evaluationDir,"review-progress.json");
const adjudicationPath=path.join(evaluationDir,"human/adjudications_v1.1.json");
const lockPath=path.join(evaluationDir,".review-write.lock");
const mainSheetName="Badcase人工复核";
const fullSheetName="全量人工复核";
let writeQueue:Promise<void>=Promise.resolve();

function normalizeArtifactWorkbookXml(input: Buffer): Promise<Buffer> {
  return JSZip.loadAsync(input).then(async (zip) => {
    const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const names = Object.keys(zip.files).filter((name) => name.endsWith(".xml"));
    await Promise.all(names.map(async (name) => {
      const file = zip.file(name);
      if (!file) return;
      let xml = await file.async("string");
      if (xml.includes("x:")) xml = xml.replace(/(<\/?)(?:x):/g, "$1").replace(/\sxmlns:x="[^"]+"/g, "");
      if (name.startsWith("xl/worksheets/sheet")) {
        xml = xml.replace(/<tableParts[\s\S]*?<\/tableParts>/g, "").replace(/<tableParts[^>]*\/>/g, "");
      }
      if (name.includes("/_rels/sheet") && name.endsWith(".xml.rels")) {
        xml = xml.replace(/<Relationship[^>]*Type="[^"]*table[^"]*"[^>]*\/>/g, "");
      }
      if (name === "[Content_Types].xml") {
        xml = xml.replace(/<Override[^>]*PartName="\/xl\/tables\/[^"]+"[^>]*\/>/g, "");
      }
      const roots: Record<string, string> = {
        "xl/workbook.xml": "workbook",
        "xl/styles.xml": "styleSheet",
        "xl/sharedStrings.xml": "sst",
        "xl/worksheets/sheet1.xml": "worksheet",
        "xl/worksheets/sheet2.xml": "worksheet",
        "xl/worksheets/sheet3.xml": "worksheet",
        "xl/tables/table1.xml": "table",
      };
      const rootName = roots[name];
      if (rootName) {
        xml = xml.replace(`<${rootName}`, `<${rootName} xmlns="${namespace}"`);
      }
      zip.file(name, xml);
    }));
    for (const name of Object.keys(zip.files)) if (name.startsWith("xl/tables/")) zip.remove(name);
    return zip.generateAsync({ type: "nodebuffer" });
  });
}


async function withWriteLock<T>(operation:()=>Promise<T>):Promise<T>{
 const run=async()=>{
  const deadline=Date.now()+15000;
  for(;;){
   try{await fs.mkdir(lockPath);break;}
   catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;if(Date.now()>deadline)throw new Error("Another review write is still running");await new Promise(resolve=>setTimeout(resolve,40));}
  }
  try{
   const manifest=await readJson<{frozenAt?:string}>(path.join(evaluationDir,"manifest_v1.1.json"),{});
   if(manifest.frozenAt)throw new Error("Benchmark is frozen; create a new evaluation version");
   return await operation();
  }finally{await fs.rmdir(lockPath);}
 };
 const result=writeQueue.then(run,run);
 writeQueue=result.then(()=>undefined,()=>undefined);return result;
}
function asAnswers(review:Record<string,string|number|null|undefined>):ReviewAnswers{
 return Object.fromEntries(REVIEW_FIELDS.map(field=>[field,review[field]??null])) as ReviewAnswers;
}
export async function getEvaluationCases():Promise<EvaluationCase[]>{
 const state=await loadCalibration(evaluationDir);
 const records=new Map(state.raw.cases.map(r=>[r.case.id,r]));
 return state.cases.map(c=>{
  const r=records.get(c.id)!;const display=displayCase(c,r,state.imported);
  const tag=c.machineDetection.type.split(/\r?\n/).find(t=>/^[A-Z_]+\/[A-Z_]+$/.test(t));
  const [primary,secondary]=tag?.split("/")??["",""];
  return {caseId:c.id,testType:c.category,newsTitle:display["新闻标题"],newsSummary:display["新闻摘要"],matchedProduct:display["匹配商品"],
   goldenExpected:display["Golden预期"],actualResult:display["系统实际结果"],relationshipPath:display["Relationship Path"],contentStrategy:display["Content Strategy"],
   weibo:display["微博结果"],xiaohongshu:display["小红书结果"],shortVideo:display["短视频结果"],machineBadcaseType:c.machineDetection.type,machineJudgeReason:c.machineDetection.reason||display["Machine / Judge 原因"],machinePriority:c.machineDetection.priority,
   reviewStatus:c.humanVerdict.status==="final"?"已评测":c.humanVerdict.status==="disputed"?"有争议":"未评测",machineSuggestedPrimary:PRIMARY.includes(primary)?primary:"",machineSuggestedSecondary:secondary,
   review:asAnswers(state.reviews[c.id]??{}),machineFlagged:c.machineDetection.flagged,benchmark:c,adjudicationInput:state.adjudications[c.id]??{},hasGeneratedContent:c.humanVerdict.wouldUseApplicable};
 });
}
export async function getReviewProgress():Promise<ReviewProgress>{return readJson(progressPath,{});}
export async function saveReview(caseId:string,incoming:unknown):Promise<SavedReview>{
 if(typeof incoming!=="object"||incoming===null||Array.isArray(incoming))throw new Error("Review fields must be an object");
 const record=incoming as Record<string,unknown>,clean:ReviewAnswers={};
 for(const field of REVIEW_FIELDS){
  if(!(field in record))continue;
  const value=record[field];if(value===null||value===""){clean[field]=null;continue;}
  if(ratingFields.includes(field)){const score=Number(value);if(!Number.isInteger(score)||score<1||score>5)throw new Error(field+" must be between 1 and 5");clean[field]=score;}
  else if(typeof value==="string")clean[field]=value.slice(0,["备注","人工问题描述","建议修复方向"].includes(field)?5000:160);
  else throw new Error(field+" must be text");
 }
 validateReviewAnswers(clean);
 return withWriteLock(async()=>{
  const state=await loadCalibration(evaluationDir);
  if(!state.cases.some(c=>c.id===caseId))throw new Error("Unknown Case ID: "+caseId);
  const progress=await getReviewProgress();
  const saved:SavedReview={...asAnswers(state.reviews[caseId]??{}),...clean,updatedAt:new Date().toISOString()};
  await atomicJson(progressPath,{...progress,[caseId]:saved});
  return saved;
 });
}
function validateReviewAnswers(answer: ReviewAnswers): void {
  const allowed: Partial<Record<ReviewField, string[]>> = {
    "是否真的是Badcase": ["是", "否", "有争议"],
    WouldUse: ["直接使用", "修改后使用", "不会使用"],
    "一级归因": [...PRIMARY],
    Severity: ["S0", "S1", "S2", "S3"],
    "是否进入需求池": ["是", "否", "待讨论"],
  };
  for (const [field, values] of Object.entries(allowed) as [ReviewField, string[]][]) {
    const value = answer[field];
    if (value != null && value !== "" && !values.includes(String(value))) throw new Error(`Invalid ${field}`);
  }
}


export async function saveAdjudication(caseId:string,incoming:unknown):Promise<AdjudicationInput>{
 if(!incoming||typeof incoming!=="object"||Array.isArray(incoming))throw new Error("Invalid adjudication object");
 const input=incoming as Record<string,unknown>;
 return withWriteLock(async()=>{
  const state=await loadCalibration(evaluationDir),c=state.cases.find(c=>c.id===caseId);
  if(!c)throw new Error("Unknown Case ID: "+caseId);
  const saved:AdjudicationInput={...state.adjudications[caseId]};
  const previous={expected:c.adjudicatedExpected,acceptableProductSkus:c.acceptableProductSkus,rootCause:state.adjudications[caseId]?.rootCause??null};
  if("expected" in input){
   if(!input.expected||typeof input.expected!=="object"||Array.isArray(input.expected))throw new Error("Invalid expected fields");
   const e=input.expected as Record<string,unknown>;
   const parsed:Partial<BenchmarkCase["adjudicatedExpected"]>={};
   for(const [key,value]of Object.entries(e)){
    if(["shouldGenerate","marketingSafe","sensitiveTopic"].includes(key)){
     if(typeof value!=="boolean")throw new Error("Invalid boolean label");
     (parsed as Record<string,unknown>)[key]=value;
    }else if(key==="fitLevel"){
     if(!["strong","medium","weak"].includes(String(value)))throw new Error("Invalid fitLevel");
     parsed.fitLevel=value as "strong"|"medium"|"weak";
    }else if(["expectedConsumerNeed","expectedRelationshipPath","forbiddenAngles"].includes(key)){
     if(!Array.isArray(value)||value.length>30||!value.every(v=>typeof v==="string"&&v.length<=2000))throw new Error("Invalid label array");
     (parsed as Record<string,unknown>)[key]=value;
    }else throw new Error("Invalid label field: "+key);
   }
   if(typeof input.reason!=="string"||input.reason.trim().length<5)throw new Error("Label reason must be at least 5 characters");
   saved.expected={...saved.expected,...parsed};saved.labelConfirmed=true;saved.reason=input.reason.trim().slice(0,5000);
   const effective={...c.originalExpected,...saved.expected};
   if(effective.shouldGenerate&&!effective.marketingSafe)throw new Error("Invalid label: unsafe event cannot Generate");
  }
  if("acceptableProductSkus" in input){
   const skus=input.acceptableProductSkus;
   const products=await readJson<Array<{sku:string}>>(path.join(process.cwd(),"data/products.json"));
   if(!Array.isArray(skus)||!skus.length||skus.length>50||!skus.every(v=>typeof v==="string"&&products.some(p=>p.sku===v)))throw new Error("Invalid acceptable SKU");
   if(typeof input.productReason!=="string"||input.productReason.trim().length<5)throw new Error("Product reason must be at least 5 characters");
   saved.acceptableProductSkus=[...new Set(skus as string[])];saved.productReason=input.productReason.trim().slice(0,5000);
  }
  if("rootCause" in input){
   const root=input.rootCause as {primary?:string;secondary?:string;reason?:string};
   if(!root||!PRIMARY.includes(root.primary??"")||!root.secondary?.trim()||!root.reason||root.reason.trim().length<5)throw new Error("Invalid root cause or reason");
   saved.rootCause={primary:root.primary!,secondary:root.secondary.slice(0,160),reason:root.reason.trim().slice(0,5000)};
  }
  if(!("expected" in input)&&!("acceptableProductSkus" in input)&&!("rootCause" in input))throw new Error("Invalid empty adjudication");
  const now=new Date().toISOString();
  saved.history=[...(saved.history??[]),{at:now,changes:{previous,next:{expected:saved.expected??{},acceptableProductSkus:saved.acceptableProductSkus??null,rootCause:saved.rootCause??null},reason:input.reason??input.productReason??(input.rootCause as {reason?:string}|undefined)?.reason}}];
  if("expected" in input){saved.source="human_review";saved.evidence="工作台 "+caseId+" 人工仲裁";saved.reviewedAt=now;}
  await atomicJson(adjudicationPath,{...state.adjudications,[caseId]:saved});return saved;
 });
}
export async function getEvaluationSummary(){
 const state=await loadCalibration(evaluationDir),cases=state.cases;
 const complete=cases.filter(c=>c.humanVerdict.status==="final");
 const averages=Object.fromEntries(ratingFields.map(field=>{const v=complete.flatMap(c=>{const x=state.reviews[c.id]?.[field];return typeof x==="number"&&x>=1&&x<=5?[x]:[]});return[field,v.length?v.reduce((a,b)=>a+b,0)/v.length:null]}));
 const wouldUse=Object.fromEntries(["直接使用","修改后使用","不会使用"].map(v=>[v,complete.filter(c=>c.humanVerdict.wouldUseApplicable&&c.humanVerdict.wouldUse===v).length]));
 const attributionTop5=Object.entries(state.summary.humanEvaluation.rootCauseDistribution).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,5);
 return {total:cases.length,completed:complete.length,disputed:state.summary.humanEvaluation.disputed,completionRate:complete.length/cases.length,confirmedBadcases:state.summary.humanEvaluation.confirmedCaseIds.length,
  machineFalseReports:state.summary.detector.fp,averages,wouldUse,attributionTop5,deepTotal:cases.filter(c=>c.machineDetection.flagged).length,deepCompleted:complete.filter(c=>c.machineDetection.flagged).length,
  lightRemaining:cases.filter(c=>!c.machineDetection.flagged&&c.humanVerdict.status!=="final").length,benchmark:state.summary,secondarySuggestions:SECONDARY};
}
async function excelWorkbook(input:Buffer){const w=new ExcelJS.Workbook();await w.xlsx.load(await normalizeArtifactWorkbookXml(input) as unknown as Parameters<typeof w.xlsx.load>[0]);return w;}
export async function exportCompletedWorkbook(mode:"deep"|"full"="deep"):Promise<Buffer>{
 const source=mode==="full"?path.join(evaluationDir,"human/full_human_review.xlsx"):workbookPath;
 const w=await excelWorkbook(await fs.readFile(source)),sheet=w.getWorksheet(mode==="full"?fullSheetName:mainSheetName);
 if(!sheet)throw new Error("Workbook sheet not found");
 const cols=new Map<string,number>();sheet.getRow(1).eachCell((c,i)=>cols.set(c.text.trim(),i));
 for(const field of ["Case ID",...REVIEW_FIELDS])if(!cols.has(field))throw new Error("Missing column: "+field);
 const state=await loadCalibration(evaluationDir),seen=new Set<string>();
 for(let n=2;n<=sheet.rowCount;n++){
  const row=sheet.getRow(n),id=row.getCell(cols.get("Case ID")!).text.trim();if(!id)continue;
  if(seen.has(id)||!state.cases.some(c=>c.id===id))throw new Error("Invalid/duplicate export Case ID: "+id);seen.add(id);
  for(const field of REVIEW_FIELDS)row.getCell(cols.get(field)!).value=state.reviews[id]?.[field]??null;
 }
 if(seen.size!==(mode==="full"?60:29))throw new Error("Export Case ID coverage mismatch");
 w.calcProperties.fullCalcOnLoad=true;
 if(mode==="full"){
  const summary=w.getWorksheet("全量进度");
  if(summary){
   summary.getCell("B1").value="Evaluation v1.1 · "+(state.summary.status==="frozen"?"已冻结":"未冻结");
   const completed=state.cases.filter(c=>c.humanVerdict.status==="final").length;
   for(const [cell,value]of Object.entries({B3:completed,B4:completed/60,B5:state.summary.humanEvaluation.confirmedCaseIds.length,B6:state.summary.humanEvaluation.notBadcaseCount,B7:state.summary.humanEvaluation.disputed})){
    const prior=summary.getCell(cell).value;
    if(prior&&typeof prior==="object"&&"formula" in prior&&typeof prior.formula==="string")summary.getCell(cell).value={formula:prior.formula,result:value};
    else summary.getCell(cell).value=value;
   }
  }
  const audit=w.addWorksheet("标签仲裁");
  audit.addRow(["Case ID","原预期","仲裁预期","确认状态","理由","原人工归因","规范化归因"]);
  for(const c of state.cases)audit.addRow([c.id,JSON.stringify(c.originalExpected),JSON.stringify(c.adjudicatedExpected),c.adjudication.status,c.adjudication.reason,c.rootCause.originalPrimary,c.rootCause.status==="confirmed"?c.rootCause.primary+"/"+c.rootCause.secondary:"待确认"]);
  audit.columns.forEach((column,index)=>{column.width=index===0?12:45;});
  audit.eachRow((row,index)=>{row.height=index===1?30:100;row.eachCell(cell=>{cell.alignment={wrapText:true,vertical:"top"};});});
  audit.views=[{state:"frozen",ySplit:1}];
 }
 return Buffer.from(await w.xlsx.writeBuffer());
}
export async function refreshEvaluationArtifacts(){
 return withWriteLock(async()=>{
  await promisify(execFile)(process.execPath,["evaluation/calibrateV1_1.mjs"],{cwd:process.cwd(),env:{...process.env,EVALUATION_DATA_DIR:evaluationDir,EVALUATION_WRITE_LOCK_HELD:"true"},maxBuffer:1024*1024});
  const state:Calibration=await loadCalibration(evaluationDir);return state.summary;
 });
}
export const evaluationWorkbookPath=workbookPath;
