import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchProducts,rankProducts} from '../lib/productMatcher.ts';
import {applyOpportunityGuards,strategyUsesSensitiveHook} from '../lib/marketingOpportunity.ts';
import {groundingIssues,usesSensitiveMarketingHook} from '../lib/contentGrounding.ts';
import {requestModelJson} from '../lib/llmTransport.ts';
import {analyzeNews,planContentStrategy,generatePlatformContent} from '../lib/llm.ts';
import {analyzeMarketingNews} from '../lib/marketingPipeline.ts';
import {sanitizeProductForCopy} from '../lib/productSanitizer.ts';

const raw=JSON.parse(fs.readFileSync('evaluation/results/raw_results_v1.json','utf8'));
const products=JSON.parse(fs.readFileSync('data/products.json','utf8'));
const record=id=>raw.cases.find(r=>r.case.id===id);
const envelope=result=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}),{status:200});
const validStrategy={audience:'家庭日常整理用户',scene:'日常整理',consumerPainPoint:'按实际用途分区整理',productRole:'用于商品详情中说明的日常用途',contentAngle:'围绕实际任务安排日常用品',coreMessage:'按实际用途选择合适用品',toneHint:'具体、克制'};
const validOpportunity=(news,overrides={})=>({productFitScore:85,fitLevel:'strong',shouldGenerate:true,fitReason:'原文提供日常使用场景',relationshipPath:[news.title,'日常需求','商品用途'],newsEvidence:[news.brief.slice(0,8)],requiresInventedScene:false,...overrides});
function installMock(t,fetcher){
 const originalFetch=globalThis.fetch;
 const keys=['LLM_BASE_URL','LLM_API_KEY','LLM_MODEL','LLM_TIMEOUT_MS','LLM_MAX_RETRIES','LLM_MAX_CONCURRENCY'];
 const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{LLM_BASE_URL:'https://local-test.invalid/v1',LLM_API_KEY:'test-only',LLM_MODEL:'test-only',LLM_TIMEOUT_MS:'3000',LLM_MAX_RETRIES:'1',LLM_MAX_CONCURRENCY:'2'});
 globalThis.fetch=fetcher;
 t.after(()=>{globalThis.fetch=originalFetch;for(const k of keys){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];}});
}
function platformResponse(prompt){
 if(prompt.includes('微博电商内容编辑'))return {title:'实际场景准备',content:'根据实际场景和商品详情选择日常用品。',hashtags:['#日常生活','#实际准备']};
 if(prompt.includes('小红书内容生态'))return {contentAngle:'实际用途',title:'日常准备',hook:'从实际需要开始准备。',content:'围绕实际用途选择用品。',tags:['日常','准备','生活'],coverText:'实际准备',imagePrompt:'真实生活场景中陈列日常用品。'};
 return {title:'日常准备',hook:'看看实际需要的用品。',scenes:[1,2,3].map(shot=>({shot,visual:'日常场景',voiceover:'围绕实际用途准备用品。'})),cta:'按实际需要了解详情。'};
}

test('EV022/EV024: generic beverage category and sales cannot select chips',()=>{
 for(const id of ['EV022','EV024'])assert.equal(matchProducts(record(id).actual.analysis.productKeyword,products).sku,'SKU002');
 assert.equal(matchProducts(['运动饮料'],products),null);
 assert.equal(matchProducts(['儿童','家庭','日常'],products),null);
 const fakeSales=products.map(p=>({...p,monthlySales:p.sku==='SKU005'?1e9:0}));
 assert.equal(matchProducts(record('EV022').actual.analysis.productKeyword,fakeSales).sku,'SKU002');
 assert.ok(!rankProducts(['瓶装水'],products).some(p=>p.sku==='SKU005'));
});

test('EV055: neutral lighting passes; health hooks and unsafe news stay blocked',()=>{
 const r=record('EV055'),input={news:r.actual.news,analysis:r.actual.analysis,product:sanitizeProductForCopy(r.actual.product)};
 const model=validOpportunity(input.news,{relationshipPath:[input.news.title,'书桌照明','台灯'],newsEvidence:['合理照明']});
 assert.equal(applyOpportunityGuards(input,model).shouldGenerate,true);
 assert.equal(applyOpportunityGuards(input,{...model,relationshipPath:[input.news.title,'治疗近视','台灯']}).shouldGenerate,false);
 assert.equal(applyOpportunityGuards({...input,analysis:{...input.analysis,marketingSafe:false}},model).shouldGenerate,false);
 assert.equal(strategyUsesSensitiveHook(input.analysis,'学生在书桌阅读，调节灯光亮度；禁止治疗近视承诺。'),false);
 assert.equal(strategyUsesSensitiveHook(input.analysis,'担心孩子近视，用台灯保护视力。'),true);
 assert.equal(usesSensitiveMarketingHook('{"tone":"禁止治疗近视","hook":"用台灯治疗近视"}'),true);
});

test('EV035: invented viewing scene and fabricated citations are rejected',()=>{
 const r=record('EV035'),input={news:r.actual.news,analysis:r.actual.analysis,product:sanitizeProductForCopy(r.actual.product)};
 const model=validOpportunity(input.news,{requiresInventedScene:true});
 assert.equal(applyOpportunityGuards(input,model).shouldGenerate,false);
 assert.equal(applyOpportunityGuards(input,{...model,requiresInventedScene:false,newsEvidence:['观众准备观影零食']}).shouldGenerate,false);
 const sports=record('EV021');
 assert.equal(applyOpportunityGuards({news:sports.actual.news,analysis:sports.actual.analysis,product:sanitizeProductForCopy(sports.actual.product)},validOpportunity(sports.actual.news,{newsEvidence:['在家与亲友观赛']})).shouldGenerate,true);
});

test('EV008: unsupported strategy is corrected once; platform copying it is rejected',async t=>{
 const r=record('EV008'),product=sanitizeProductForCopy(r.actual.product);
 const issues=groundingIssues(Object.values(r.actual.contentStrategy).join(' '),r.actual.news,product);
 assert.ok(issues.some(s=>s.includes('翻倍')));assert.ok(issues.some(s=>s.includes('省液')));
 let calls=0;
 installMock(t,async()=>envelope(++calls===1?r.actual.contentStrategy:validStrategy));
 const strategy=await planContentStrategy(r.actual.news,r.actual.analysis,product,r.actual.opportunityEvaluation);
 assert.equal(calls,2);assert.deepEqual(strategy,validStrategy);
 calls=0;globalThis.fetch=async()=>{calls++;return envelope(r.actual.platformContents.weibo)};
 await assert.rejects(generatePlatformContent('weibo',{news:r.actual.news,analysis:r.actual.analysis,product,opportunityEvaluation:r.actual.opportunityEvaluation,contentStrategy:strategy}),e=>e.code==='PLATFORM_GENERATION_ERROR');
 assert.equal(calls,2);
});

test('EV021/EV038: transient network and unreadable envelope recover; auth errors do not retry',async t=>{
 let calls=0;installMock(t,async()=>{if(++calls===1)throw new TypeError('synthetic connection reset');return envelope({ok:true})});
 assert.deepEqual(await requestModelJson('test'),{ok:true});assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>++calls===1?new Response('<html>temporary gateway error</html>'):envelope({ok:true});
 assert.deepEqual(await requestModelJson('test'),{ok:true});assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('never expose provider secrets',{status:401})};
 await assert.rejects(requestModelJson('test'),e=>e.code==='LLM_HTTP_ERROR'&&!e.message.includes('secrets'));
 assert.equal(calls,1);
 const sports=record('EV021');let opportunityCalls=0;
 globalThis.fetch=async(_url,options)=>{
  const prompt=JSON.parse(options.body).messages[0].content;
  if(prompt.includes('新闻营销机会与商品匹配专家'))return envelope(sports.actual.analysis);
  if(prompt.includes('品牌营销策略审核专家')){
   if(++opportunityCalls===1)throw new TypeError('synthetic connection reset');
   return envelope(validOpportunity(sports.actual.news,{newsEvidence:['在家与亲友观赛']}));
  }
  if(prompt.includes('内容营销策略师'))return envelope(validStrategy);
  return envelope(platformResponse(prompt));
 };
 const recovered=await analyzeMarketingNews(sports.actual.news,products,'test-EV021');
 assert.equal(opportunityCalls,2);assert.equal(recovered.executionStatus,'success');
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('<html>persistent unreadable envelope</html>')};
 const unreadable=await analyzeMarketingNews(record('EV038').actual.news,products,'test-EV038');
 assert.equal(calls,2);assert.equal(unreadable.errorCode,'LLM_RESPONSE_ERROR');assert.equal(unreadable.decisionStatus,'unknown');
});

test('EV039: missing schema is corrected once, persistent failure stays error/unknown',async t=>{
 const r=record('EV039');let calls=0;
 const complete={...r.actual.analysis,marketingSafe:true,riskLevel:'low',consumerNeed:'',productKeyword:[],reason:'没有自然商品关联。',riskReason:'',sensitiveTopic:false};
 installMock(t,async()=>envelope(++calls===1?{...complete,riskReason:null}:complete));
 assert.equal((await analyzeNews(r.actual.news)).marketingSafe,true);assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return envelope({marketingSafe:true,riskLevel:'low'})};
 const item=await analyzeMarketingNews(r.actual.news,products,'test-EV039');
 assert.equal(calls,2);assert.equal(item.executionStatus,'error');assert.equal(item.decisionStatus,'unknown');
 assert.equal(item.failureType,'analysis');assert.equal(item.errorCode,'NEWS_ANALYSIS_ERROR');
});

test('candidate fallback is bounded; approval of an alternative is a simulated evaluator decision',async t=>{
 const r=record('EV018');let evaluations=0;
 installMock(t,async(_url,options)=>{
  const prompt=JSON.parse(options.body).messages[0].content;
  if(prompt.includes('新闻营销机会与商品匹配专家'))return envelope(r.actual.analysis);
  if(prompt.includes('品牌营销策略审核专家')){
   evaluations++;const accepted=prompt.includes('食品保鲜袋200只');
   return envelope(validOpportunity(r.actual.news,{productFitScore:accepted?65:35,fitLevel:accepted?'medium':'weak',shouldGenerate:accepted,newsEvidence:['分区收纳']}));
  }
  if(prompt.includes('内容营销策略师'))return envelope(validStrategy);
  return envelope(platformResponse(prompt));
 });
 const item=await analyzeMarketingNews(r.actual.news,products,'test-EV018');
 assert.equal(evaluations,3);assert.equal(item.product.sku,'SKU032');assert.equal(item.decisionStatus,'generate');assert.equal(item.executionStatus,'success');
 // This verifies orchestration; it does not adjudicate this SKU's real relevance.
});

test('successful rejection is not an execution error; one failed platform stays partial',async t=>{
 const r=record('EV008');let failPlatform=false;
 installMock(t,async(_url,options)=>{
  const prompt=JSON.parse(options.body).messages[0].content;
  if(prompt.includes('新闻营销机会与商品匹配专家'))return envelope(r.actual.analysis);
  if(prompt.includes('品牌营销策略审核专家'))return envelope(validOpportunity(r.actual.news,{productFitScore:failPlatform?85:30,fitLevel:failPlatform?'strong':'weak',shouldGenerate:failPlatform}));
  if(prompt.includes('内容营销策略师'))return envelope(validStrategy);
  if(prompt.includes('微博电商内容编辑'))return envelope({title:'missing fields'});
  return envelope(platformResponse(prompt));
 });
 const reject=await analyzeMarketingNews(r.actual.news,products,'test-reject');
 assert.equal(reject.executionStatus,'success');assert.equal(reject.decisionStatus,'reject');assert.equal(reject.error,undefined);
 failPlatform=true;
 const partial=await analyzeMarketingNews(r.actual.news,products,'test-partial');
 assert.equal(partial.executionStatus,'partial');assert.equal(partial.decisionStatus,'generate');
 assert.equal(partial.platformStatuses.weibo,'failed');assert.equal(partial.platformStatuses.xiaohongshu,'success');
 let unsafeCalls=0;
 globalThis.fetch=async()=>{unsafeCalls++;return envelope(record('EV041').actual.analysis)};
 const unsafe=await analyzeMarketingNews(record('EV041').actual.news,products,'test-unsafe');
 assert.equal(unsafeCalls,1);assert.equal(unsafe.decisionStatus,'reject');
 assert.ok(Object.values(unsafe.platformContents).every(value=>value===null));
});

test('request concurrency is bounded and total timeout includes the response',async t=>{
 let running=0,peak=0;
 installMock(t,async()=>{running++;peak=Math.max(peak,running);await new Promise(r=>setTimeout(r,30));running--;return envelope({ok:true})});
 await Promise.all([1,2,3,4].map(()=>requestModelJson('test')));assert.ok(peak<=2);
 process.env.LLM_TIMEOUT_MS='1000';
 globalThis.fetch=async(_url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new Error('synthetic abort')),{once:true});setTimeout(()=>resolve(envelope({late:true})),1300)});
 await assert.rejects(requestModelJson('test'),e=>e.code==='LLM_TIMEOUT');
});
