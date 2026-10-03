import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {buildBenchmark,summarizeBenchmark,clusteredBacklog} from './benchmarkV1_1.mjs';
export const humanFields=['是否真的是Badcase','营销逻辑自然度','商品植入自然度','内容策略合理性','事实可信度','平台适配度','安全性','WouldUse','一级归因','二级归因','Severity','人工问题描述','建议修复方向','是否进入需求池','备注'];
export const machineFields=['Case ID','测试类型','新闻标题','新闻摘要','匹配商品','Golden预期','系统实际结果','Relationship Path','Content Strategy','微博结果','小红书结果','短视频结果','机器Badcase类型','Machine / Judge 原因','机器建议优先级'];
export const headers=[...machineFields,...humanFields];
export const sha=b=>createHash('sha256').update(b).digest('hex');
export async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e;}}
export async function atomicJson(file,value){const tmp=file+'.'+process.pid+'.'+randomUUID()+'.tmp';await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await fs.rename(tmp,file);}finally{await fs.unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
export async function withFileLock(root,operation){
 const lock=path.join(root,'.review-write.lock'),deadline=Date.now()+15000;
 for(;;){try{await fs.mkdir(lock);break;}catch(e){if(e.code!=='EEXIST')throw e;if(Date.now()>deadline)throw new Error('Another evaluation write is still running');await new Promise(r=>setTimeout(r,40));}}
 try{return await operation();}finally{await fs.rmdir(lock);}
}
export async function loadCompatibleWorkbook(bytes){
 const zip=await JSZip.loadAsync(bytes);
 for(const name of Object.keys(zip.files).filter(n=>n.endsWith('.xml'))){
  let xml=await zip.file(name).async('string');
  xml=xml.replace(/(<\/?)(?:x):/g,'$1').replace(/\sxmlns:x="[^"]+"/g,'');
  if(name.startsWith('xl/worksheets/'))xml=xml.replace(/<tableParts[\s\S]*?<\/tableParts>/g,'').replace(/<tableParts[^>]*\/>/g,'');
  if(name==='[Content_Types].xml')xml=xml.replace(/<Override[^>]*PartName="\/xl\/tables\/[^"]+"[^>]*\/>/g,'');
  const root=name==='xl/workbook.xml'?'workbook':name==='xl/styles.xml'?'styleSheet':name==='xl/sharedStrings.xml'?'sst':/^xl\/worksheets\/sheet\d+\.xml$/.test(name)?'worksheet':null;
  if(root&&!new RegExp('<'+root+'[^>]*xmlns=').test(xml))xml=xml.replace('<'+root,'<'+root+' xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"');
  zip.file(name,xml);
 }
 for(const name of Object.keys(zip.files))if(name.startsWith('xl/tables/'))zip.remove(name);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await zip.generateAsync({type:'nodebuffer'}));return workbook;
}
export async function refreshWorkbookCopies(state){
 const backlogFile=path.join(state.root,'backlog/v1.2.3_backlog.xlsx');
 try{
  const w=await loadCompatibleWorkbook(await fs.readFile(backlogFile)),s=w.getWorksheet('V1.2.3需求池');
  const oldHeader=s.getRow(1).values.slice(1);
  s.spliceRows(2,s.rowCount-1);
  for(const row of state.backlog)s.addRow(oldHeader.map(f=>row[f]??null));
  s.autoFilter={from:'A1',to:'O'+(state.backlog.length+1)};
  s.eachRow((r,n)=>{r.height=n===1?35:100;r.eachCell({includeEmpty:true},c=>{c.alignment={wrapText:true,vertical:'top'};c.font={name:'Microsoft YaHei',size:11,color:{argb:'FF243B2D'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:n===1?'FF365F47':n%2?'FFFFFFFF':'FFF0F5F1'}};if(n===1)c.font={name:'Microsoft YaHei',size:11,bold:true,color:{argb:'FFFFFFFF'}};});});
  for(let n=2;n<=state.backlog.length+1;n++)s.getCell('L'+n).numFmt='0.0%';
  s.addRow(['候选需求，待全量复核和仲裁完成后更新。']);
  const tmp=backlogFile+'.tmp';await w.xlsx.writeFile(tmp);await fs.rename(tmp,backlogFile);
 }catch(e){if(e.code!=='ENOENT')throw e;}
}
export async function importHuman(root) {
 const file=path.join(root,'human/badcase_human_review_completed.xlsx');
 const bytes=await fs.readFile(file),workbook=new ExcelJS.Workbook();
 await workbook.xlsx.load(bytes);
 const sheet=workbook.getWorksheet('Badcase人工复核');
 if(!sheet)throw new Error('Missing Badcase人工复核 sheet');
 const columns=new Map();sheet.getRow(1).eachCell((c,i)=>columns.set(c.text.trim(),i));
 for(const h of headers)if(!columns.has(h))throw new Error('Missing Excel header: '+h);
 const reviews={},flags={},displayRows={};
 sheet.eachRow((row,n)=>{
  if(n===1)return;
  const id=row.getCell(columns.get('Case ID')).text.trim();if(!id)return;
  if(reviews[id])throw new Error('Duplicate Excel Case ID: '+id);
  const get=h=>row.getCell(columns.get(h));
  reviews[id]=Object.fromEntries(humanFields.map(h=>[h,get(h).text===''?null:typeof get(h).value==='number'?get(h).value:get(h).text]));
  displayRows[id]=Object.fromEntries(machineFields.map(h=>[h,get(h).text]));
  flags[id]={type:get('机器Badcase类型').text,priority:get('机器建议优先级').text,reason:get('Machine / Judge 原因').text};
 });
 return {source:'human/badcase_human_review_completed.xlsx',sha256:sha(bytes),reviews,flags,displayRows};
}
export async function loadCalibration(root=path.resolve(process.env.EVALUATION_DATA_DIR||'evaluation')) {
 const manifest=await readJson(path.join(root,'manifest_v1.1.json'),null);
 if(manifest){
  for(const [file,hash]of Object.entries({...manifest.sourceHashes,...(manifest.frozenAt?manifest.frozenHashes:{})}))
   if(sha(await fs.readFile(path.join(root,file)))!==hash)throw new Error('Benchmark source changed: '+file);
 }
 const dataset=await readJson(path.join(root,'dataset/evaluation_v1.json'));
 const raw=await readJson(path.join(root,'results/raw_results_v1.json'));
 const imported=await readJson(path.join(root,'human/review_import_v1.1.json'));
 const progress=manifest?.frozenAt?Object.fromEntries(Object.entries(await readJson(path.join(root,'human/human_verdicts_v1.1.json'))).map(([id,r])=>[id,r.answers])):await readJson(path.join(root,'review-progress.json'),{});
 const reviews={...imported.reviews,...Object.fromEntries(Object.entries(progress).map(([id,r])=>[id,{...imported.reviews[id],...r}]))};
 const adjudications=await readJson(path.join(root,'human/adjudications_v1.1.json'),{});
 const cases=buildBenchmark(dataset,raw,imported.flags,reviews,adjudications);
 const summary=summarizeBenchmark(cases,raw,reviews);
 if(manifest?.frozenAt)summary.status='frozen';
 return {root,dataset,raw,imported,reviews,adjudications,cases,summary,backlog:clusteredBacklog(cases,reviews,summary)};
}
export function displayCase(c,record,imported) {
 if(imported.displayRows[c.id])return imported.displayRows[c.id];
 const a=record.actual,pp=v=>v==null?'未生成':JSON.stringify(v,null,2);
 return {'Case ID':c.id,'测试类型':c.category,'新闻标题':c.news.title,'新闻摘要':c.news.brief,
 '匹配商品':a.product?a.product.sku+' · '+a.product.name:'没有匹配商品',
 'Golden预期':pp({...c.originalExpected,expectedProductSku:c.originalProductSku,expectedProductName:c.product.name}),'系统实际结果':pp({executionStatus:c.executionStatus,decisionStatus:c.decisionStatus,marketingSafe:a.analysis?.marketingSafe,fitLevel:a.opportunityEvaluation?.fitLevel,error:record.error??null,reason:a.analysis?.reason}),
 'Relationship Path':a.opportunityEvaluation?.relationshipPath?.join(' → ')||'无关联路径','Content Strategy':pp(a.contentStrategy),
 '微博结果':pp(a.platformContents?.weibo),'小红书结果':pp(a.platformContents?.xiaohongshu),'短视频结果':pp(a.platformContents?.douyin),
 '机器Badcase类型':'','Machine / Judge 原因':record.judgeResult?.summary||'原机器未标记；请检查是否漏报。','机器建议优先级':''};
}
export function buildReviewRows(state) {
 const records=new Map(state.raw.cases.map(r=>[r.case.id,r]));
 return state.cases.map(c=>{const d=displayCase(c,records.get(c.id),state.imported);const r=state.reviews[c.id]??{};return headers.map(h=>machineFields.includes(h)?d[h]??'':r[h]??null);});
}
