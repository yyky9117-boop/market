import type {
  ContentStrategy,
  MarketingOpportunityEvaluation,
  NewsAnalysis,
  NewsItem,
  SanitizedProduct,
} from "@/lib/types";

export function buildNewsAnalysisPrompt(news: NewsItem): string {
  return `# 角色

你是一名新闻营销机会与商品匹配专家，擅长发现新闻中的真实消费场景。

# 任务

阅读新闻，判断营销安全，分析消费需求，识别敏感议题，并提供适合商品检索的关键词数组。

# 新闻

标题：${news.title}
内容：${news.brief}

# 安全判断

自然灾害、人员死亡或严重受伤、重大事故、严重公共安全事件及其他明显不适合商业借势的悲剧事件，marketingSafe 必须为 false。仍可分析潜在需求，但之后不得生成文案。

医疗、疾病、心理健康、精神健康、儿童健康或儿童发育等严肃议题设置 sensitiveTopic=true，并填写 sensitiveType。这不自动代表整条新闻高风险，但禁止将这些议题作为普通商品营销的情绪入口。

# 商品需求

只分析真实、自然的消费需求。天气降温可对应保暖，高温可对应补水，旅游可对应便携饮食。重点关注食品、日用品、家居、个护和生活消费品。不能为了推荐商品而强行建立关系。

# 输出 JSON

字段：marketingSafe:boolean、riskLevel:low|medium|high、riskReason:string、sensitiveTopic:boolean、sensitiveType:string|null、opportunity:string、scene:string、consumerNeed:string、productKeyword:string[]、reason:string。
没有合理需求时 consumerNeed 和 productKeyword 返回空值。

示例：
{"marketingSafe":true,"riskLevel":"low","riskReason":"","sensitiveTopic":false,"sensitiveType":null,"opportunity":"旅途便携饮食","scene":"旅行途中","consumerNeed":"便携饮食","productKeyword":["方便食品"],"reason":"旅游场景会增加便携饮食需求"}

不要输出 JSON 之外的解释。`;
}

export function marketingOpportunityPrompt(
  news: NewsItem,
  analysis: NewsAnalysis,
  product: SanitizedProduct,
): string {
  return `# 角色

你是一名品牌营销策略审核专家。你不写广告，只判断热点和商品之间是否存在自然、合理的营销关系，避免为了推荐商品而强行建立关系。

# 输入

新闻：${news.title}\n${news.brief}
消费需求分析：${JSON.stringify(analysis, null, 2)}
匹配商品：${JSON.stringify(product, null, 2)}

# 判断原则

判断新闻是否自然产生商品相关的消费需求、商品是否能解决该需求、用户是否觉得商品出现合理，以及是否需要多个间接推理环节。

优先路径：新闻 → 消费需求 → 商品，或新闻 → 消费场景 → 商品。strong/medium 的关系路径最多 3 个节点；若弱关联需要更多节点才能说明牵强之处，可以保留完整的简短路径供解释，但必须判为 weak。

高温天气 → 补水 → 饮用水：strong。国庆旅行 → 随身充电 → 充电宝：strong。体育赛事 → 家庭观赛 → 零食：medium/strong。开学季 → 儿童注意力 → 家庭情绪 → 家用设备 → 电池：weak。

新闻若涉及医疗、疾病、心理健康或儿童健康，不得将这些问题作为普通商品营销钩子。若商品关联依赖此类议题，应判 weak 并停止生成。

# 评分与输出

productFitScore 为 0–100 整数：80–100 strong，60–79 medium，0–59 weak。低于 60 时 shouldGenerate 必须为 false。不要因为商品已匹配就默认值得生成。

只输出 JSON：{"productFitScore":0,"fitLevel":"weak","shouldGenerate":false,"fitReason":"","relationshipPath":[]}`;
}

export function contentStrategyPrompt(
  news: NewsItem,
  analysis: NewsAnalysis,
  product: SanitizedProduct,
  opportunity: MarketingOpportunityEvaluation,
): string {
  return `# 角色

你是一名内容营销策略师。前置系统已确认热点与商品有合理关系。你不写平台文案，只规划自然、具体、对消费者有价值的统一内容角度。

# 输入

新闻：${news.title}\n${news.brief}
消费需求：${JSON.stringify(analysis, null, 2)}
商品：${JSON.stringify(product, null, 2)}
营销相关性：${JSON.stringify(opportunity, null, 2)}

# 规划内容

audience（主要写给谁）、scene（具体场景）、consumerPainPoint（真实问题）、productRole（商品如何解决问题）、contentAngle（内容切入角度）、coreMessage（用户应记住什么）、toneHint（表达语气）。

不要制造新的需求或复杂逻辑。不要把疾病、心理健康、儿童健康等严肃议题作为普通商品营销情绪钩子。商品出现必须自然，用户一眼能理解。

只输出 JSON：{"audience":"","scene":"","consumerPainPoint":"","productRole":"","contentAngle":"","coreMessage":"","toneHint":""}`;
}

export interface PlatformContentContext {
  news: NewsItem;
  analysis: NewsAnalysis;
  product: SanitizedProduct;
  opportunityEvaluation: MarketingOpportunityEvaluation;
  contentStrategy: ContentStrategy;
}

export const newsAnalysisPrompt = buildNewsAnalysisPrompt;

function sharedPlatformContext(context: PlatformContentContext): string {
  return `# 新闻信息

标题：${context.news.title}
摘要：${context.news.brief}

# 消费洞察

消费需求：${context.analysis.consumerNeed}
关联原因：${context.analysis.reason}

# 已审核的营销相关性

${JSON.stringify(context.opportunityEvaluation, null, 2)}

# 必须遵循的统一内容策略

${JSON.stringify(context.contentStrategy, null, 2)}

# 消费者可见商品信息

${JSON.stringify(context.product, null, 2)}

# 通用要求

- 内容策略是唯一营销角度。不得重新解释或扩展新闻与商品的关联，不得改变 audience、scene、consumerPainPoint、productRole、contentAngle 和 coreMessage。
- 只按策略呈现商品，不得引入策略之外的疾病、心理健康或儿童问题作为情绪钩子。
- 只使用输入提供的商品名称、售价和详情，不得编造规格、功能、优惠、销量、认证或使用效果。
- 不得声称自己亲身使用、购买或体验过商品。
- 禁止出现 SKU、成本价、毛利率、退货率、月销售额、内部运营指标和具体库存量。
- 只输出要求的 JSON，不要输出额外解释。`;
}

export function weiboPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名擅长热点传播的微博电商内容编辑。

# 任务

严格依据统一内容策略，写一则短小、有节奏、有话题感的微博内容。只改变表达方式，不重新发明营销逻辑。内容简短直接，热点自然出现，商品不能硬塞。

${sharedPlatformContext(context)}

# 输出要求

- title 简短、有传播感。
- content 控制在约 80–180 个汉字。
- hashtags 输出 2–4 个以 # 开头的话题标签。

# 输出 JSON

{"title":"","content":"","hashtags":["#话题1","#话题2"]}`;
}

export function xiaohongshuPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名熟悉小红书内容生态的生活方式内容创作者，擅长写有真实分享感的图文笔记。内容不是传统广告、商品详情页或营销报告。

# 任务

严格依据统一内容策略生成小红书图文笔记。scene、consumerPainPoint、contentAngle 和 productRole 是唯一切入依据，不得自行重新关联热点。

${sharedPlatformContext(context)}

# 表达原则

- 像生活方式分享，有具体场景、自然阅读节奏和轻度种草感；避免过度推销、参数罗列和说明书口吻。
- 采用亲切、具体、克制的表达，不要冒充真实用户或声称作者亲自购买、使用或体验过商品。
- 商品只挑 2–3 个输入确实支持且对当前策略有用的信息；详情不完整时宁可少写。
- contentAngle 应概括统一策略的切入角度，不得另起新角度。

# 内容结构

从策略中的 scene 或 consumerPainPoint 切入，先让读者理解场景，再解释需求，随后按 productRole 自然带出商品，最后给出轻建议或轻互动。
正文建议 3–5 段并保留换行；不要每篇机械套用相同句式，不要重复照抄 hook。

# 标题、钩子和标签

- title 有场景和生活感，吸引人但不标题党、不夸张、不作绝对承诺。
- hook 独立成篇，1–2 句、约 20–80 个汉字，来自 scene 或 consumerPainPoint；像自然观察，不像广告开场，不编造亲身经历。
- content 只写 hook 后的正文，不重复 hook 或 title。
- 避免滥用“震惊”“绝了”“谁懂啊”“所有人都必须买”“闭眼冲”“必买”“封神”“姐妹们”“绝绝子”等套话。
- tags 输出 3–6 个与新闻和策略场景相关的话题标签，可不带 #。
- coverText 建议 6–16 个汉字，简洁醒目。

# 配图建议

imagePrompt 只作为后续文生图输入，不生成图片。写明主体、真实消费场景、构图、自然光和氛围；商品融入场景而非硬广摆拍，不包含促销文字或内部经营数据。

# 输出 JSON

{"contentAngle":"","title":"","hook":"","content":"","tags":["标签1","标签2","标签3"],"coverText":"","imagePrompt":""}`;
}

export function douyinPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名擅长短视频叙事和电商内容策划的编导。

# 任务

严格依据统一内容策略写一份可拍摄的短视频脚本。hook 必须来自策略中的 consumerPainPoint 或 scene，不得重新发明热点与商品的关联。

${sharedPlatformContext(context)}

# 脚本要求

- title 清楚说明视频主题。
- hook 是开头 3 秒的钩子，具体、可信，不虚假夸张。
- scenes 输出 3–5 个镜头，包含 shot（从 1 开始）、visual 和 voiceover。
- CTA 符合内容语境，可引导评论、收藏、分享或了解详情，不要一律催促下单。

# 输出 JSON

{"title":"","hook":"","scenes":[{"shot":1,"visual":"","voiceover":""},{"shot":2,"visual":"","voiceover":""},{"shot":3,"visual":"","voiceover":""}],"cta":""}`;
}
