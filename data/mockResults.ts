import type { GenerateResultItem, Product } from "@/lib/types";
import productData from "@/data/products.json";

const products = productData as Product[];

function findProduct(subcategory: string): Product {
  const product = products.find((item) => item.subcategory.includes(subcategory));
  if (product) return product;
  if (products[0]) return products[0];
  throw new Error("商品目录为空，请先从商品 Excel 生成 data/products.json。");
}

function createItem(
  id: string,
  event: string,
  title: string,
  brief: string,
  source: string,
  consumerNeed: string,
  productKeyword: string,
  reason: string,
  product: Product,
  headline: string,
  content: string,
  marketingAngle: string,
  hashtags: string[],
  safe = true,
): GenerateResultItem {
  const contentStrategy = safe ? {
    audience: `关注${event}的消费者`,
    scene: `${event}相关生活准备`,
    consumerPainPoint: consumerNeed,
    productRole: `为${consumerNeed}提供一个实际选择`,
    contentAngle: marketingAngle,
    coreMessage: `结合实际场景，提前安排${consumerNeed}`,
    toneHint: "生活化、实用、克制",
  } : null;
  return {
    id,
    news: {
      title,
      brief,
      source: `Mock 演示 · ${source}`,
      url: "",
    },
    analysis: {
      marketingSafe: safe,
      riskLevel: safe ? "low" : "high",
      riskReason: safe ? "" : "该热点涉及突发灾害，不适合开展商业借势。",
      sensitiveTopic: false,
      sensitiveType: null,
      opportunity: `${consumerNeed}相关准备`,
      scene: `${event}场景下的日常准备`,
      consumerNeed,
      productKeyword: [productKeyword],
      reason,
    },
    product,
    opportunityEvaluation: safe ? {
      productFitScore: 86,
      fitLevel: "strong",
      shouldGenerate: true,
      fitReason: reason,
      relationshipPath: [event, consumerNeed, product.subcategory],
    } : null,
    contentStrategy,
    platformContents: safe ? {
      weibo: {
        title: headline,
        content,
        hashtags,
      },
      xiaohongshu: {
        contentAngle: contentStrategy?.contentAngle ?? marketingAngle,
        title: `${consumerNeed}怎么准备？从一个小场景开始`,
        hook: `${contentStrategy?.scene ?? event}时，可以先留意一个实际的小需求：${contentStrategy?.consumerPainPoint ?? consumerNeed}。`,
        content: `${contentStrategy?.scene ?? event}中，${contentStrategy?.consumerPainPoint ?? consumerNeed}都值得按实际情况提前想一想。\n\n${product.name}可以作为一个选择，${product.detail}。${contentStrategy?.productRole ?? `如果需要${consumerNeed}，可以了解商品信息`}。\n\n是否需要准备，还是按自己的行程和需要来安排。你会提前检查哪些小事？`,
        tags: [event, consumerNeed, "生活方式", "出行准备"],
        coverText: `${consumerNeed}准备思路`,
        imagePrompt: `一张自然简约的小红书生活方式摄影。主体为${product.name}，放在与${event}相关的真实生活场景中；采用干净留白构图、柔和自然光和轻松日常氛围，商品以真实包装自然融入画面，不添加促销文字，不展示任何经营数据。`,
      },
      douyin: {
        title: `${contentStrategy?.scene ?? event}中的${consumerNeed}准备`,
        hook: `${contentStrategy?.consumerPainPoint ?? consumerNeed}，可以结合${contentStrategy?.scene ?? event}提前检查。`,
        scenes: [
          { shot: 1, visual: `镜头展示${contentStrategy?.scene ?? event}，再带到与${consumerNeed}有关的真实生活细节。`, voiceover: `${contentStrategy?.scene ?? event}里，可以先留意${contentStrategy?.consumerPainPoint ?? consumerNeed}。` },
          { shot: 2, visual: `展示${product.name}与相关使用场景，不添加商品详情之外的信息。`, voiceover: `${contentStrategy?.productRole ?? `如果需要${consumerNeed}，可以了解这款商品`}。` },
          { shot: 3, visual: `收好物品后展示整洁的出行准备或日常场景，最后回到商品与清单。`, voiceover: `把适合自己的东西提前安排好，准备起来更有条理。` },
        ],
        cta: `你在${contentStrategy?.scene ?? event}还会检查什么？欢迎聊聊。`,
      },
    } : {
      weibo: null,
      xiaohongshu: null,
      douyin: null,
    },
    platformStatuses: safe
      ? { weibo: "success", xiaohongshu: "success", douyin: "success" }
      : { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" },
  };
}

export function getMockResults(query: string): GenerateResultItem[] {
  const highRisk = /地震|灾害|洪水|事故|伤亡|火灾|台风|泥石流/.test(query);
  const event = query.trim();

  if (/无商品匹配|无匹配商品|商品未匹配/.test(query)) {
    return [{
      id: "1",
      news: {
        title: `${event}相关热点讨论`,
        brief: `Mock 模式下用于演示无商品匹配状态的${event}新闻摘要。`,
        source: "Mock 演示 · 状态示例",
        url: "",
      },
      analysis: {
        marketingSafe: true,
        riskLevel: "low",
        riskReason: "",
        sensitiveTopic: false,
        sensitiveType: null,
        opportunity: "",
        scene: `${event}热点讨论`,
        consumerNeed: "当前商品库中暂无对应需求商品",
        productKeyword: ["未匹配商品"],
        reason: "该示例用于演示商品库没有相关商品时的状态。",
      },
      product: null,
      opportunityEvaluation: null,
      contentStrategy: null,
      platformContents: { weibo: null, xiaohongshu: null, douyin: null },
      platformStatuses: { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" },
      failureType: "product",
    }];
  }

  if (/AI技术突破|人工智能技术突破|弱关联/.test(query)) {
    const product = findProduct("方便食品");
    return [{
      id: "1",
      news: {
        title: `${event}引发讨论`,
        brief: "技术进展受到关注，但新闻没有形成与普通食品直接相关的消费需求。",
        source: "Mock 演示 · 弱关联判断",
        url: "",
      },
      analysis: {
        marketingSafe: true,
        riskLevel: "low",
        riskReason: "",
        sensitiveTopic: false,
        sensitiveType: null,
        opportunity: "",
        scene: "科技新闻讨论",
        consumerNeed: "",
        productKeyword: ["方便食品"],
        reason: "该热点与普通食品之间没有明显消费需求联系。",
      },
      product,
      opportunityEvaluation: {
        productFitScore: 31,
        fitLevel: "weak",
        shouldGenerate: false,
        fitReason: "科技进展没有自然产生食品需求，不建议强行借势营销。",
        relationshipPath: ["AI 技术突破", "普通食品"],
      },
      contentStrategy: null,
      platformContents: { weibo: null, xiaohongshu: null, douyin: null },
      platformStatuses: { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" },
    }];
  }

  if (/ADHD|儿童心理|儿童健康|抑郁|焦虑症/.test(query)) {
    const product = findProduct("电池");
    return [{
      id: "1",
      news: {
        title: `${event}相关话题受到关注`,
        brief: "该 Mock 案例用于确保儿童健康与心理话题不会成为普通商品的营销情绪入口。",
        source: "Mock 演示 · 敏感话题",
        url: "",
      },
      analysis: {
        marketingSafe: true,
        riskLevel: "medium",
        riskReason: "",
        sensitiveTopic: true,
        sensitiveType: "child_health",
        opportunity: "",
        scene: "儿童健康与心理议题",
        consumerNeed: "",
        productKeyword: ["电池"],
        reason: "严肃健康议题不应被转化为普通商品营销入口。",
      },
      product,
      opportunityEvaluation: {
        productFitScore: 24,
        fitLevel: "weak",
        shouldGenerate: false,
        fitReason: "该关联依赖儿童健康或心理议题，不适合作为普通商品营销入口。",
        relationshipPath: [event, "儿童心理", "家庭用品", "电池"],
      },
      contentStrategy: null,
      platformContents: { weibo: null, xiaohongshu: null, douyin: null },
      platformStatuses: { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" },
    }];
  }

  if (/开学季.*电池|电池.*开学季/.test(query)) {
    const product = findProduct("电池");
    const result = createItem(
      "1", "开学季", "开学准备别漏了常用小设备", "开学前整理用品时，也可以顺手检查闹钟、计算器等常用设备。", "Mock 演示 · 自然商品关联",
      "学习设备检查", "电池", "开学准备中的设备检查与电池用途直接相关。", product,
      "开学准备清单，也检查一下常用设备", "整理书本和文具时，也可以顺手看看闹钟、计算器等常用设备是否能正常使用。\n\n如果确实需要更换电池，按设备要求提前备好就行，不用临时到处找。", "开学前设备检查", ["#开学季", "#开学准备", "#生活小事"], true,
    );
    result.opportunityEvaluation = {
      productFitScore: 82,
      fitLevel: "strong",
      shouldGenerate: true,
      fitReason: "开学前检查闹钟、计算器等学习生活设备时，电池是直接相关的日常耗材。",
      relationshipPath: ["开学准备", "学习设备检查", "电池"],
    };
    result.contentStrategy = {
      audience: "有学龄儿童的家庭",
      scene: "开学前整理学习和生活用品",
      consumerPainPoint: "闹钟、计算器等常用设备临时没电",
      productRole: "作为家庭常备耗材解决临时缺电",
      contentAngle: "开学前容易被忽略的设备检查",
      coreMessage: "开学准备不只是书本文具，常用设备也值得提前检查",
      toneHint: "生活化、实用、不制造焦虑",
    };
    return [result];
  }

  if (/体育赛事|亚运会|足球赛|比赛/.test(query)) {
    const result = createItem(
      "1", "体育赛事", "观赛时刻，准备一点顺手的小零食", "赛事直播也带动居家观赛场景，适量准备方便分享的零食。", "Mock 演示 · 中关联场景",
      "居家观赛时的零食分享", "坚果", "赛事带来居家观赛场景，零食适合观赛时分享，但不是赛事本身的直接需求。", findProduct("坚果"),
      "观赛时刻，准备一点顺手的小零食", "看比赛时，很多人会约上家人朋友一起坐下来。准备一点方便分享的小零食，就能让观赛时光更轻松。", "居家观赛与零食分享", ["#体育赛事", "#居家观赛", "#零食分享"], true,
    );
    result.opportunityEvaluation = {
      productFitScore: 76,
      fitLevel: "medium",
      shouldGenerate: true,
      fitReason: "赛事直播带来居家观赛场景，零食适合观赛时分享，属于自然但非直接的消费关联。",
      relationshipPath: ["体育赛事", "居家观赛", "坚果零食"],
    };
    result.contentStrategy = {
      audience: "喜欢在家看赛事的消费者",
      scene: "与家人朋友居家观赛",
      consumerPainPoint: "观赛时想准备方便分享的小零食",
      productRole: "作为观赛时的分享零食选择",
      contentAngle: "居家观赛与零食分享",
      coreMessage: "观赛零食按人数和喜好适量准备即可",
      toneHint: "轻松、克制、不制造消费压力",
    };
    return [result];
  }

  const first = createItem(
    "1",
    event,
    highRisk
      ? `${event}相关情况持续受到关注`
      : `${event}热度上升，出行与生活消费场景增加`,
    highRisk
      ? `近期${event}相关信息引发关注，公众正在等待权威部门发布后续情况。`
      : `围绕${event}的讨论持续升温，消费者开始关注出行准备、补给与日常体验。`,
    "热点速览",
    highRisk ? "应急饮水与基础物资" : "出行补水与便携补给",
    highRisk ? "饮用水" : "饮用水",
    highRisk
      ? "突发事件可能带来基础物资需求，但不应借事件进行商业营销。"
      : "出行和户外活动会增加随身补水需求，关联自然且实用。",
    findProduct("饮用水"),
    "出发前，把补水这件小事准备好",
    "行程排得满满当当，也别忘了给自己留一份轻松。550ml 瓶装，日常出行随手带上，路上补水更方便。",
    "出行补给",
    [`#${event.replace(/\s/g, "")}`, "#出行补给", "#生活小准备"],
    !highRisk,
  );

  const second = createItem(
    "2",
    event,
    `${event}带动户外休闲讨论升温`,
    `天气与假期话题让更多人开始规划户外休闲时间，轻便、易携带的途中补给受到关注。`,
    "城市生活观察",
    "户外途中补充能量",
    "坚果零食",
    "户外休闲场景适合准备便携零食，坚果组合可以作为途中补给选择。",
    findProduct("坚果"),
    "把一点能量，装进出发的背包",
    "从公园散步到周末短途，包里带点顺手的小零食，休息时刻也能更自在。多种坚果与果干组合，分享或自己享用都方便。",
    "户外休闲与随身分享",
    [`#${event.replace(/\s/g, "")}`, "#周末出行", "#随身零食"],
    true,
  );

  const third = createItem(
    "3",
    event,
    `${event}相关生活消费话题持续发酵`,
    `热点讨论也带动居家与日常备货话题，方便快捷的餐食选择获得不少关注。`,
    "消费趋势简报",
    "快捷方便的日常餐食",
    "方便食品",
    "忙碌行程或居家备餐场景中，便捷餐食能满足简单、快速的用餐需求。",
    findProduct("方便食品"),
    "忙碌的时候，也要好好吃一餐",
    "计划赶不上变化时，给自己留一个简单的用餐选择。经典风味与 5 袋组合装，适合早餐、夜宵或家中常备。",
    "日常便捷饮食",
    [`#${event.replace(/\s/g, "")}`, "#方便快捷", "#日常备餐"],
    true,
  );

  return highRisk ? [first] : [first, second, third];
}
