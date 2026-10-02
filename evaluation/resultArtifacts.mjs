import { evaluateCase } from './machineMetrics.mjs';

const PLATFORMS = ['weibo', 'xiaohongshu', 'douyin'];
const ALLOWED_MODULES = new Set([
  'NEWS_UNDERSTANDING','SAFETY_GATE','SENSITIVE_TOPIC','CONSUMER_NEED','PRODUCT_MATCHING','MARKETING_RELEVANCE',
  'CONTENT_STRATEGY','WEIBO_GENERATION','XHS_GENERATION','DOUYIN_GENERATION','HALLUCINATION','INTERNAL_DATA_LEAK',
  'NEWS_SOURCE','ENGINEERING_ERROR','LATENCY',
]);

function csvCell(value) {
  const text = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function normalizedModule(tag, record, metrics) {
  const raw = String(tag?.module ?? '').toUpperCase();
  const subtype = String(tag?.subType ?? '').toUpperCase();
  if (metrics.internalDataLeak) return 'INTERNAL_DATA_LEAK';
  if (metrics.safetyPass === false) return 'SAFETY_GATE';
  if (metrics.safetyFalsePositive) return record.case?.category === 'sensitive' ? 'SENSITIVE_TOPIC' : 'SAFETY_GATE';
  if (record.error || record.judgeError) return 'ENGINEERING_ERROR';
  if (metrics.severeHallucinationConfirmed || record.judgeResult?.confirmedHallucination || /FACTUALITY|HALLUCINATION/.test(raw)) return 'HALLUCINATION';
  if (/PRODUCT_RELEVANCE|PRODUCT_ASSOCIATION|PRODUCT_LINK|PRODUCT_MATCH/.test(raw) || /WRONG_PRODUCT|PRODUCT_MISMATCH/.test(subtype)) return 'PRODUCT_MATCHING';
  if (/CONSUMER_NEED/.test(raw)) return 'CONSUMER_NEED';
  if (/CONTENT_STRATEGY/.test(raw)) return 'CONTENT_STRATEGY';
  if (/WEIBO/.test(raw)) return 'WEIBO_GENERATION';
  if (/XHS|XIAOHONGSHU/.test(raw)) return 'XHS_GENERATION';
  if (/DOUYIN|DOU_YIN/.test(raw)) return 'DOUYIN_GENERATION';
  if (/SAFETY/.test(raw)) return 'SAFETY_GATE';
  if (/NEWS|ANALYSIS/.test(raw)) return 'NEWS_UNDERSTANDING';
  if (/RELATION|DECISION|FIT|RELEVANCE|OPPORTUNITY|GENERATE/.test(raw)) return 'MARKETING_RELEVANCE';
  if (ALLOWED_MODULES.has(raw)) return raw;
  return 'MARKETING_RELEVANCE';
}

function normalizedSubtype(module, tag, record, metrics) {
  const raw = String(tag?.subType ?? '').toUpperCase();
  if (metrics.internalDataLeak) return 'SOURCE_FIELD_LEAK';
  if (metrics.safetyPass === false) return 'UNSAFE_GENERATION';
  if (metrics.safetyFalsePositive) return module === 'SENSITIVE_TOPIC' ? 'SAFE_ANGLE_OVERBLOCKED' : 'FALSE_SAFETY_BLOCK';
  if (record.error || record.judgeError) return 'MODEL_SERVICE_ERROR';
  if (module === 'HALLUCINATION') {
    if (/EFFICACY|EFFECT|PAIN_POINT/.test(raw)) return 'FAKE_EFFICACY';
    if (/FEATURE|FUNCTION/.test(raw)) return 'FAKE_FUNCTION';
    if (/PRICE/.test(raw)) return 'FAKE_PRICE';
    if (/DISCOUNT|PROMOTION/.test(raw)) return 'FAKE_DISCOUNT';
    if (/SALES/.test(raw)) return 'FAKE_SALES';
    if (/CERTIFICATION/.test(raw)) return 'FAKE_CERTIFICATION';
    return 'FAKE_NEWS_FACT';
  }
  if (module === 'PRODUCT_MATCHING') return 'WRONG_PRODUCT';
  if (module === 'SAFETY_GATE') return 'RISK_LEVEL_MISCLASSIFIED';
  if (module === 'SENSITIVE_TOPIC') return 'SAFE_ANGLE_OVERBLOCKED';
  if (module === 'CONSUMER_NEED') return 'FAKE_PAIN_POINT';
  if (module === 'CONTENT_STRATEGY') return /ANGLE|SENSITIVE/.test(raw) ? 'SENSITIVE_ANGLE' : 'FAKE_PAIN_POINT';
  if (!metrics.shouldGenerateCorrect) return 'WRONG_GENERATE_DECISION';
  if (!metrics.fitLevelCorrect) return 'WRONG_FIT_LEVEL';
  if (/RELATION|PATH/.test(raw)) return 'FORCED_ASSOCIATION';
  return 'UNCLASSIFIED_REVIEW';
}

function compactActual(actual, judge) {
  return {
    marketingSafe: actual?.analysis?.marketingSafe ?? null,
    sensitiveTopic: actual?.analysis?.sensitiveTopic ?? null,
    actualProductSku: actual?.product?.sku ?? null,
    actualProductName: actual?.product?.name ?? null,
    fitLevel: actual?.opportunityEvaluation?.fitLevel ?? null,
    productFitScore: actual?.opportunityEvaluation?.productFitScore ?? null,
    shouldGenerate: actual?.opportunityEvaluation?.shouldGenerate ?? false,
    relationshipPath: actual?.opportunityEvaluation?.relationshipPath ?? [],
    platformStatuses: actual?.platformStatuses ?? {},
    error: actual?.error ?? null,
    judgeSummary: judge?.summary ?? null,
  };
}

export function buildBadcasesCsv(records, version) {
  const header = ['caseId','version','category','module','subType','severity','inputSummary','expected','actual','judgeScore','humanScore','problemDescription','rootCause','suggestedFix','owner','priority','status'];
  const rows = [];
  for (const record of records) {
    const metrics = evaluateCase(record);
    const fixture = record.case;
    const judge = record.judgeResult;
    const platformFailure = fixture.expected.shouldGenerate &&
      PLATFORMS.some((platform) => record.actual?.platformStatuses?.[platform] === 'failed');
    const needsReview = !metrics.shouldGenerateCorrect || !metrics.fitLevelCorrect || metrics.safetyPass === false ||
      metrics.safetyFalsePositive || metrics.internalDataLeak || metrics.severeHallucinationConfirmed ||
      judge?.confirmedHallucination === true || judge?.internalDataLeak === true || judge?.decision === 'fail' ||
      record.error || record.judgeError || platformFailure;
    if (!needsReview) continue;

    const firstTag = judge?.badcaseTags?.[0];
    const moduleName = normalizedModule(firstTag, record, metrics);
    const subType = normalizedSubtype(moduleName, firstTag, record, metrics);
    const safetyFailure = metrics.safetyPass === false;
    const severity = safetyFailure || metrics.internalDataLeak ? 'S0'
      : !metrics.shouldGenerateCorrect ? 'S1'
        : judge?.severity && judge.severity !== 'none' ? judge.severity
          : platformFailure || record.error || record.judgeError ? 'S2' : 'S2';
    const priority = severity === 'S0' ? 'P0' : severity === 'S1' ? 'P1' : moduleName === 'ENGINEERING_ERROR' ? 'P1' : 'P2';
    const rootCause = moduleName === 'PRODUCT_MATCHING'
      ? '初步判断：新闻需求关键词与商品检索/排序结果不一致，需检查分析关键词及匹配权重。'
      : moduleName === 'MARKETING_RELEVANCE'
        ? '初步判断：关联强度或 shouldGenerate 边界与 Golden 标签不一致。'
        : moduleName === 'HALLUCINATION'
          ? '初步判断：文案包含商品详情和新闻摘要无法支持的宣称。'
          : moduleName === 'ENGINEERING_ERROR'
            ? '初步判断：模型服务请求或响应结构异常，需区分网络、服务端错误和 JSON 校验失败。'
            : moduleName === 'SENSITIVE_TOPIC'
              ? '初步判断：敏感话题门与安全表达角度的判断过度拦截。'
              : '待复核：以原始 Pipeline 输入输出确认根因。';
    const suggestedFix = moduleName === 'PRODUCT_MATCHING'
      ? '检查 productKeyword 生成和 matchProducts 排序；为相似商品/错配案例补充边界约束。'
      : moduleName === 'MARKETING_RELEVANCE'
        ? '针对 medium 与 weak Hard Cases 校准关系路径、分数区间及生成阈值。'
        : moduleName === 'HALLUCINATION'
          ? '约束功效、促销和新闻事实宣称必须有输入证据，并加入发布前事实扫描。'
          : moduleName === 'ENGINEERING_ERROR'
            ? '增加可控重试、结构化错误分类和响应格式恢复；重跑失败案例确认是否瞬时错误。'
            : moduleName === 'SENSITIVE_TOPIC'
              ? '将悲剧营销安全门与敏感话题角度门拆分，验证中性教育型表达与无关商品拒绝。'
              : '复核 Judge 评语并补充模块级回归案例。';

    rows.push([
      fixture.id, version, fixture.category, moduleName, subType, severity,
      `${fixture.news.title} ${fixture.news.brief}`,
      fixture.expected,
      compactActual(record.actual, judge),
      judge?.scores ?? '', '',
      judge?.summary ?? record.error ?? record.judgeError ?? '机器规则发现与 Golden 标签不一致。',
      rootCause, suggestedFix, 'AI 产品 / 工程', priority, 'triage',
    ].map(csvCell).join(','));
  }
  return `\uFEFF${header.join(',')}\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`;
}

export function buildBacklogCsv(records) {
  const badcases = records.map((record) => ({ record, metrics: evaluateCase(record) }));
  const groups = [
    {
      requirementId: 'REQ-EVAL-001', requirementTitle: '提升热点需求到商品 SKU 的匹配准确性',
      module: 'PRODUCT_MATCHING', problemPattern: '新闻意图关键词、商品类型和具体 SKU 之间出现错配，导致后续关联评分和内容全部偏移。',
      proposedSolution: '复核新闻 productKeyword 抽取与 matcher 评分；加入类目约束、可接受 SKU 规则和错配回归集。',
      expectedMetricImpact: 'Product Match Accuracy、ShouldGenerate Accuracy、Fit Level Accuracy 上升。', priority: 'P1',
      matches: (item) => item.record.judgeResult?.badcaseTags?.some((tag) => /PRODUCT_RELEVANCE|PRODUCT_ASSOCIATION|PRODUCT_LINK|PRODUCT_MATCH/.test(String(tag.module))) && /WRONG_PRODUCT|PRODUCT_MISMATCH/.test(String(item.record.judgeResult.badcaseTags.map((tag) => tag.subType).join(' '))),
    },
    {
      requirementId: 'REQ-EVAL-002', requirementTitle: '校准 Medium / Weak 关联与 shouldGenerate 判断',
      module: 'MARKETING_RELEVANCE', problemPattern: '边界场景 fit level 与生成决策偏离 Golden，出现合理机会被拒绝和牵强关系被放行。',
      proposedSolution: '以 10 条 Medium 和 10 条 Weak Hard Case 调整关联路径约束和阈值；优先避免 weak 误生成。',
      expectedMetricImpact: 'ShouldGenerate Accuracy、Weak Case Reject Accuracy、Fit Level Accuracy 上升。', priority: 'P1',
      matches: (item) => !item.metrics.shouldGenerateCorrect || !item.metrics.fitLevelCorrect,
    },
    {
      requirementId: 'REQ-EVAL-003', requirementTitle: '减少无依据的商品功效和事实宣称',
      module: 'HALLUCINATION', problemPattern: '文案加入商品详情未支持的功能、效果、量化结果或新闻细节。',
      proposedSolution: '强化商品证据边界；生成后对效果、促销、销量、认证及量化事实进行校验。',
      expectedMetricImpact: 'Judge-confirmed Hallucination Rate 和不可直接使用率下降。', priority: 'P1',
      matches: (item) => item.record.judgeResult?.confirmedHallucination === true,
    },
    {
      requirementId: 'REQ-EVAL-004', requirementTitle: '提高模型调用和结构化响应稳定性',
      module: 'ENGINEERING_ERROR', problemPattern: '模型请求连接失败、响应无法解析或分析字段不完整导致案例中断。',
      proposedSolution: '区分网络错误、HTTP 错误和 schema 错误；对可恢复错误做有限重试并保留原始响应摘要。',
      expectedMetricImpact: 'Pipeline/Platform Generation Success Rate 上升，错误率与 P95 latency 可解释。', priority: 'P1',
      matches: (item) => Boolean(item.record.error || item.record.judgeError),
    },
    {
      requirementId: 'REQ-EVAL-005', requirementTitle: '减少敏感边界的过度拦截',
      module: 'SENSITIVE_TOPIC', problemPattern: '将敏感话题直接判为 marketingSafe=false，未区分禁止商业借势和允许的中性场景表达。',
      proposedSolution: '分离悲剧安全门、敏感主题标签和内容角度约束；复测健康科普与无关商品拒绝边界。',
      expectedMetricImpact: 'Safety False Positive Rate 下降，同时保持 Safety Recall。', priority: 'P2',
      matches: (item) => item.metrics.safetyFalsePositive || (item.record.case.category === 'sensitive' && !item.metrics.shouldGenerateCorrect),
    },
  ];
  const header = ['requirementId','requirementTitle','sourceBadcaseCount','module','problemPattern','impact','severity','proposedSolution','priority','expectedMetricImpact','status'];
  const rows = groups.map((group) => {
    const count = badcases.filter(group.matches).length;
    if (!count) return null;
    const severity = group.priority === 'P1' ? 'S1/S2' : 'S2';
    return [group.requirementId,group.requirementTitle,count,group.module,group.problemPattern,'影响 Pipeline 核心判断、内容可信度或稳定性。',severity,group.proposedSolution,group.priority,group.expectedMetricImpact,'proposed'].map(csvCell).join(',');
  }).filter(Boolean);
  return `\uFEFF${header.join(',')}\r\n${rows.join('\r\n')}\r\n`;
}
