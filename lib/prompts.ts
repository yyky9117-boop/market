import type { NewsAnalysis, NewsItem, SanitizedProduct } from "@/lib/types";

export function buildNewsAnalysisPrompt(news: NewsItem): string {
  return `# 角色

你是一名新闻营销机会与商品匹配专家。

你擅长阅读新闻，
发现新闻中的消费场景，
并判断新闻与商品之间是否存在自然的营销关系。

# 任务

根据提供的新闻完成：

1. 判断该新闻是否适合进行商业营销。
2. 分析新闻可能产生的消费需求。
3. 给出一个最适合作为商品检索使用的关键词。

# 新闻信息

新闻标题：

${news.title}

新闻内容：

${news.brief}

# 营销安全判断

首先判断新闻是否适合商业借势。

如果新闻主要涉及以下内容：

- 自然灾害
- 人员死亡或严重受伤
- 重大事故
- 严重公共安全事件
- 大规模灾难
- 其他明显不适合商业借势的悲剧事件

则：

marketingSafe = false

此时仍然允许分析：

消费需求
商品需求
商品关键词

但是之后不应该生成商业营销文案。

普通天气变化、节假日、消费趋势、旅游、娱乐、体育、科技、生活方式等内容可以正常判断营销机会。

# 商品需求分析

阅读新闻后：

分析这个事件可能产生什么真实消费需求。

例如：

天气降温
→
保暖需求
→
保暖衣物

旅游热度增加
→
便携饮食需求
→
方便食品

高温天气
→
补水、防晒、降温需求

重点关注：

食品
日用品
家居
个护
生活消费品

商品匹配必须自然。

不能为了推荐商品而强行建立关系。

# 输出要求

必须返回 JSON。

格式：

{
  "marketingSafe": true,
  "riskLevel": "low",
  "riskReason": "",
  "consumerNeed": "便携饮食",
  "productKeyword": "方便食品",
  "reason": "旅游场景会增加便携饮食需求"
}

riskLevel 只能为：

low
medium
high

如果找不到合理商品需求：

{
  "marketingSafe": true,
  "riskLevel": "low",
  "riskReason": "",
  "consumerNeed": "",
  "productKeyword": "",
  "reason": "没有合适的商品关联"
}

不要输出 JSON 之外的额外解释。
`;
}

export function buildMarketingCopyPrompt(
  news: NewsItem,
  consumerNeed: string,
  product: SanitizedProduct,
): string {
  return `# 角色

你是一名专业的电商营销文案专家。

你擅长将新闻热点、消费者场景和商品卖点自然结合，
创作适合社交媒体传播的商品营销内容。

# 任务

根据新闻信息和商品信息，
生成自然、有吸引力、面向消费者的营销文案。

# 新闻

标题：

${news.title}

摘要：

${news.brief}

# 消费需求

${consumerNeed}

# 商品信息

${JSON.stringify(product, null, 2)}

# 工作流程

1. 阅读新闻。
2. 找到新闻中的热点和消费场景。
3. 阅读商品信息。
4. 提炼消费者真正关心的商品卖点。
5. 建立新闻场景和商品之间自然合理的联系。
6. 生成适合社交媒体传播的营销内容。

# 商品信息使用规则

商品数据可能来自内部商品数据库。

内部经营数据只能用于系统选品，
禁止直接写入消费者文案。

禁止出现：

- SKU
- 成本价
- 毛利率
- 退货率
- 月销售额
- 内部运营指标
- 不必要的具体库存数量

特别注意：

即使商品退货率很低，
也禁止出现：

“退货率仅 0.3%”

之类的消费者营销表达。

即使库存很多，
也不要出现：

“库存还有 2240 件”

之类的内部库存数据。

可以使用：

- 商品名称
- 商品规格
- 售价
- 商品真实功能
- 商品详情中的真实卖点
- 使用场景

# 文案原则

文案应该：

自然
简洁
像真实营销内容
有场景感
突出消费者价值

不要简单把数据库字段罗列出来。

不要写成商品数据报告。

不得编造输入中不存在：

价格
评分
功能
规格
优惠
销量
认证
库存
效果

等商品信息。

# 输出前检查

生成结果前检查：

1. 是否出现退货率？
2. 是否出现毛利率？
3. 是否出现成本价？
4. 是否出现 SKU？
5. 是否泄露内部经营数据？
6. 是否出现不必要的库存数字？
7. 是否编造商品卖点？
8. 商品与新闻是否存在合理关联？

如果存在问题，
重新生成后再输出。

# 输出格式

返回 JSON：

{
  "headline": "文案标题",
  "content": "完整营销文案",
  "marketingAngle": "营销角度",
  "hashtags": [
    "#话题1",
    "#话题2"
  ]
}

不要输出 JSON 之外的解释。
`;
}

export interface PlatformContentContext {
  news: NewsItem;
  analysis: NewsAnalysis;
  product: SanitizedProduct;
}

export const newsAnalysisPrompt = buildNewsAnalysisPrompt;

function sharedPlatformContext(context: PlatformContentContext): string {
  return `# 新闻信息

标题：${context.news.title}
摘要：${context.news.brief}

# 消费洞察

消费需求：${context.analysis.consumerNeed}
关联原因：${context.analysis.reason}

# 消费者可见商品信息

${JSON.stringify(context.product, null, 2)}

# 通用要求

- 新闻与商品必须存在自然、真实的联系；关联牵强时，使用克制的场景表达，不要夸大热点。
- 只使用输入提供的商品名称、售价和详情，不得编造规格、功能、优惠、销量、认证或使用效果。
- 不得声称自己亲身使用、购买或体验过商品。
- 禁止出现 SKU、成本价、毛利率、退货率、月销售额、内部运营指标和具体库存量。
- 只输出要求的 JSON，不要输出额外解释。`;
}

export function weiboPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名擅长热点传播的微博电商内容编辑。

# 任务

结合热点、消费场景与商品真实信息，写一则短小、有节奏、有话题感的微博营销内容。热点自然融入，商品不能硬塞，不要机械罗列参数。

${sharedPlatformContext(context)}

# 输出要求

- title 简短、有传播感。
- content 精炼、适合快速阅读，控制在约 80–180 个汉字。
- hashtags 输出 2–4 个以 # 开头的话题标签。

# 输出 JSON

{"title":"","content":"","hashtags":["#话题1","#话题2"]}`;
}

export function xiaohongshuPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名熟悉生活方式图文表达的小红书内容编辑。

# 任务

生成自然、有场景感的图文种草笔记。内容应包含场景引入、需求或准备思路、商品自然融入和轻量 CTA，像分享而非商品详情页。不要伪造个人亲身体验。

${sharedPlatformContext(context)}

# 标题与配图要求

- title 有具体场景和吸引力，但不要标题党、绝对化或夸张承诺。
- tags 输出 3–6 个小红书风格标签，可不带 #。
- coverText 简洁醒目，建议 6–16 个汉字，适合封面排版。
- imagePrompt 需写明主体、场景、构图、光线、氛围、风格和商品展示方式；整体为自然、真实、简约的生活方式摄影感，商品自然融入画面。不得包含内部经营数据。

# 输出 JSON

{"title":"","content":"","tags":["标签1","标签2"],"coverText":"","imagePrompt":""}`;
}

export function douyinPrompt(context: PlatformContentContext): string {
  return `# 角色

你是一名擅长短视频叙事和电商内容策划的编导。

# 任务

围绕热点和真实消费场景，写一份可拍摄的短视频脚本。短视频风格偏抖音，但表达真实、克制。

${sharedPlatformContext(context)}

# 脚本要求

- title 清楚说明视频主题。
- hook 是开头 3 秒的钩子，说明观众继续看的理由，不得虚假夸张。
- scenes 输出 3–5 个镜头。每个镜头必须包含 shot（从 1 开始的整数）、visual（具体可拍摄的画面描述）和 voiceover（对应口播）。
- CTA 符合内容语境，可引导评论、收藏、分享或了解详情，不要一律催促下单。

# 输出 JSON

{"title":"","hook":"","scenes":[{"shot":1,"visual":"","voiceover":""},{"shot":2,"visual":"","voiceover":""},{"shot":3,"visual":"","voiceover":""}],"cta":""}`;
}
