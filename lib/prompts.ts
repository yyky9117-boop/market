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
空值必须使用 consumerNeed=""、productKeyword=[]，其他字符串字段仍需返回字符串；不能省略字段或用 null 替代字符串。
新闻没有明确的消费场景时，不得凭“热度带来兴趣”创造消费行为。例如获奖名单与评审讨论不等于观众准备观影零食；只有新闻确实提到观赛、观影准备等场景，才可分析相应需求。

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
敏感新闻中的独立日常场景可以评估，例如新闻明确提到合理照明，可用“书桌阅读 → 照明需求 → 台灯”，不因“学生、学习、家长”这些词自动拒绝。禁止承诺预防或治疗近视、借筛查结果制造焦虑。
不得把获奖名单、市场涨跌、航天成果等信息自行扩展为观影、聚餐、护肤等新闻没有提供的消费场景。商品存在于目录中不代表需求成立。
newsEvidence 必须引用新闻标题或摘要中支持消费场景的原文片段（不是分析器自己的推测）。天气等直接生活需求可以由原文中的天气场景推导；仅引用“获奖名单”不能证明观影零食需求。requiresInventedScene 标明是否必须补充新闻未提供的行为才能成立；若是则判 weak。

# 评分与输出

productFitScore 为 0–100 整数：80–100 strong，60–79 medium，0–59 weak。低于 60 时 shouldGenerate 必须为 false。不要因为商品已匹配就默认值得生成。

只输出 JSON：{"productFitScore":0,"fitLevel":"weak","shouldGenerate":false,"fitReason":"","relationshipPath":[],"newsEvidence":[],"requiresInventedScene":true}`;
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
统一内容策略不得以售价、价格高低、优惠或性价比作为切入角度，后续消费者文案不展示价格。
优先沿用新闻已出现的实际任务，先说明日常操作，再以商品详情中明确支持的用途带出商品；不要为制造痛点而虚构风险、焦虑或购买理由。
新闻仅说频次增加时不能写“翻倍”；“浓缩”不自动证明省液、省空间、去除异味或防止发黄。商品详情没有用量说明时，不得杜撰“少量即可”等操作要求。无法证明的效果和数字不要进入 productRole、contentAngle 或 coreMessage。
学生书桌照明等中性场景可保留，但不能使用视力筛查、疾病、诊断或儿童心理问题作为营销钩子，也不能作治疗或预防承诺。

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
- 只使用输入提供的商品名称和详情，不得编造规格、功能、优惠、销量、认证或使用效果。
- 所有平台的消费者文案和脚本字段都不得出现售价、价格、货币金额、折扣价格或“性价比”等价格话术；商品规格中的数量或容量可以正常表达。
- 策略不是事实来源：如果策略含有新闻或商品详情不能支持的效果、数字或用量要求，应省略这些内容，不能复制或扩大。“频次增加”不等于“翻倍”，“浓缩”不等于省液、省收纳空间或避免发黄。
- 不得声称自己亲身使用、购买或体验过商品。
- 禁止出现 SKU、成本价、毛利率、退货率、月销售额、内部运营指标和具体库存量。
- 只输出要求的 JSON，不要输出额外解释。`;
}

export function weiboPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名擅长热点传播的微博电商内容编辑，能把已确认的新闻场景写成简短、顺口、有具体信息的微博内容，让商品自然出现在与它有关的生活讨论中。

# 任务

严格依据统一内容策略，写一则适合微博阅读和转发的短内容。只调整平台表达方式，不重新解释热点与商品的关系，不制造新的消费需求。

${sharedPlatformContext(context)}

# 写作方法

从策略中的 scene 或 consumerPainPoint 选一个最具体的切入口：读者此时要做的一件事、容易忽略的一个细节，或面临的一个实际取舍。用新闻中已有的事实交代场景，然后尽快进入这个问题；不要先复述整段新闻，也不要写“随着热度持续攀升，相关需求日益增长”之类的套话。

正文只讲清一条线：发生了什么生活场景、有什么实际准备或选择、商品在其中能起什么作用。顺序可以随语气调整，不必写成三句格式相同的说明。商品只使用 1–2 个输入明确支持的信息，不罗列参数。

# 微博表达

- title 简短、有明确看点，让人知道讨论的是什么场景；不与 content 第一句重复，不写成夸张的新闻标题。
- content 控制在约 80–180 个汉字。用自然口语和长短有变化的句子；可以分成两个短段，不要逐条列成商品报告。
- 开头直接给具体观察、问题或准备动作，不用“最近这个热点刷屏了”“你知道吗”“速看”“谁懂啊”等万能开场。
- 商品出现之前先让读者理解它与当前场景的关系，不突然转成“推荐一款××”或“这时候就需要××”。
- 结尾适合讨论时可留一个与场景有关的简短问题；不适合提问时自然结束，不机械地要求转发、评论或购买。emoji 可以不用，使用时最多点缀 1 个。
- hashtags 输出 2–4 个以 # 开头的话题，优先选择新闻中的真实场景、消费需求或商品品类；不虚构热搜词或传播趋势，也不堆砌无关标签。

# 输出前检查

检查开头是否有具体信息，删掉套话后内容是否仍完整，商品出现是否自然，title 与 content 是否重复，每项事实是否有输入依据。发现空话、硬广、虚构信息或价格表述时，先改写再输出。

# 输出 JSON

{"title":"","content":"","hashtags":["#话题1","#话题2"]}`;
}

export function xiaohongshuPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名熟悉小红书内容生态的生活方式内容创作者，擅长把具体生活场景写成有阅读吸引力、也有实际信息的图文笔记。表达自然、有节奏，避免传统广告、商品详情页和营销报告的口吻。

# 任务

严格依据统一内容策略生成小红书图文笔记。scene、consumerPainPoint、contentAngle 和 productRole 是唯一切入依据，不得自行重新关联热点。

${sharedPlatformContext(context)}

# 小红书内容创作

先从策略中的 scene 和 consumerPainPoint 找一个具体生活细节：读者正在准备什么、容易漏掉什么，或面临什么实际取舍。围绕这个细节写，不要先概括新闻再机械介绍商品。文案要有分享感，但不能冒充真实用户或声称作者亲自购买、使用或体验过商品。

content 从 hook 继续往下写，使用短段落，让每段带来一个新信息：具体观察、可执行的准备动作、取舍理由，或商品在当前场景中的作用。不要固定套用“提出痛点—介绍商品—总结推荐”，也不要反复换词说同一件事。建议时把动作说清楚，少用“先想一想、按实际情况、值得留意、提升体验、轻松应对、可以作为一个选择”等空泛表达。

商品应在读者已经理解需求之后出现。先说明它在当前场景里解决什么问题，再选 1–2 个输入确实支持的商品信息；避免参数罗列和万能商品式夸赞。详情不足时宁可少写，不为凑字数补卖点。用新闻标题、摘要或商品详情中已有的具体信息增加画面感；不虚构人物、行动、时间、地点、数字或效果。

语气亲切、口语化，可以自然点缀少量 emoji，但不要每段都放或硬塞流行梗。结尾可以提出一个与正文有关、读者容易回答的小问题；如果提问不自然，就用一句有用的提醒收束，不强行要求点赞、收藏或购买。

# 标题、钩子和标签

- title 让目标读者一眼看出“这和我有什么关系”：写出具体场景、问题或实用收获，优先使用输入支持的物件或动作。避免“XX怎么准备？从一个小场景开始”式空标题；不标题党、不制造焦虑、不作绝对承诺。
- hook 像自然聊天的开场：1–2 句、约 20–60 个汉字，来自 scene 或 consumerPainPoint，抛出一个有画面感的细节、准备动作或实际取舍。提供 title 之外的新信息，不以商品名或促销语开头，不编造亲身经历。
- content 只写 hook 后的正文，不重复 hook 或 title。
- 避免滥用“震惊”“绝了”“谁懂啊”“所有人都必须买”“闭眼冲”“必买”“封神”“姐妹们”“绝绝子”等套话。
- tags 输出 3–6 个与新闻和策略场景相关的话题标签，可不带 #。
- contentAngle 应概括统一策略的切入角度，不得另起新角度。
- coverText 建议 6–16 个汉字，简洁醒目，不与 title 完全重复。

# 输出前检查

检查 title、hook 和 content 是否各自提供新信息，正文是否有具体场景与有用的准备思路，商品是否在合理的位置出现。发现空话、重复、硬广或无依据的商品信息时，先改写再输出。

# 配图建议

imagePrompt 只作为后续文生图输入，不生成图片。写明主体、真实消费场景、构图、自然光和氛围；商品融入场景而非硬广摆拍，不包含促销文字或内部经营数据。

# 输出 JSON

{"contentAngle":"","title":"","hook":"","content":"","tags":["标签1","标签2","标签3"],"coverText":"","imagePrompt":""}`;
}

export function douyinPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名擅长商品营销短视频的编导，能把已确认的热点场景写成有节奏、可拍摄、有消费者价值的脚本。

# 任务

严格依据统一内容策略写一份可拍摄的短视频脚本。hook 必须来自策略中的 consumerPainPoint 或 scene，不得重新发明热点与商品的关联。

${sharedPlatformContext(context)}

# 脚本要求

- title 清楚说明视频主题，点出具体场景或读者能获得的内容，不写空泛的“热点好物推荐”。
- hook 是开头 3 秒的钩子，从策略中的 consumerPainPoint 或 scene 提出一个具体问题、细节或取舍。让观众愿意继续看，但不以“最近刷屏”“全网都在买”或夸大承诺制造热度，不直接把商品名当钩子。
- scenes 输出 3–5 个镜头，包含 shot（从 1 开始连续编号）、visual 和 voiceover。每个镜头都要能拍、能理解；visual 写明确主体与动作，voiceover 写适合口播的短句。相邻镜头逐步推进：让人看到场景、理解需求，再看到商品如何发挥策略指定的作用。不要每个镜头都重复热点或商品名称，也不要在第一个镜头逐字重复 hook。
- 热点只使用输入新闻已确认的信息，不凭空设计新闻画面、采访、真实用户使用片段或传播数据。可用普通生活场景表现需求，不要求借用新闻素材。商品只呈现 1–2 个输入确实支持、与当前需求有关的卖点；不得虚构功能演示、对比效果、材质、用户好评或信任背书。
- 台词要有口语节奏，短句优先；用具体动作与画面承担信息，不写“功能拉满、性价比拉满、轻松搞定”之类没有依据的万能台词。场景与商品关联不足时不要用夸张情绪强行补足。
- CTA 符合内容语境，可引导评论、收藏、分享或了解详情；不要一律催促下单，也不得编造限时优惠、购买链接或库存紧迫感。输出前检查开头是否吸引人、镜头是否可执行、商品信息是否真实、结尾是否自然。

# 输出 JSON

{"title":"","hook":"","scenes":[{"shot":1,"visual":"","voiceover":""},{"shot":2,"visual":"","voiceover":""},{"shot":3,"visual":"","voiceover":""}],"cta":""}`;
}
