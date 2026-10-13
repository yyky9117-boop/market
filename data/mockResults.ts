import type { GenerateResultItem, Product } from "@/lib/types";
import productData from "@/data/products.json";

const products = productData as Product[];

function findProduct(subcategory: string): Product {
  const product = products.find((item) => item.subcategory.includes(subcategory));
  if (product) return product;
  if (products[0]) return products[0];
  throw new Error("商品目录为空，请先从商品 Excel 生成 data/products.json。");
}

function noMatchExample(event: string, reason: string): GenerateResultItem {
  return {
    id: "1",
    news: {
      title: `${event}相关话题（演示案例）`,
      brief: "该条为 Mock 演示资料，用于展示商品关联不足时的处理结果。",
      source: "Mock 演示 · 无自然商品关联",
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
      consumerNeed: "",
      productKeyword: [],
      reason,
    },
    product: null,
    opportunityEvaluation: null,
    contentStrategy: null,
    platformContents: { weibo: null, xiaohongshu: null, douyin: null },
    platformStatuses: { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" },
    executionStatus: "success",
    decisionStatus: "reject",
  };
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
        title: `${event}清单里，别漏了${consumerNeed}`,
        hook: `开始准备${event}时，先看看${consumerNeed}有没有真正安排好。`,
        content: `把需要的东西写进清单，比临出门再找更从容。${contentStrategy?.scene ?? event}，可以先确认自己会在哪里、什么时候用到。\n\n如果确实需要${consumerNeed}，${product.name}是一种选择。商品资料显示：${product.detail}\n\n根据自己的行程和人数准备即可，别为了赶热点多买。`,
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
    return [noMatchExample(event, "当前演示目录没有预置合理的商品关联，已停止内容生成。")];
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

  if (/开学季|开学/.test(query)) {
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

  if (!highRisk && !/国庆|旅游|出行|露营|户外|高温|炎热|假期/.test(query)) {
    return [noMatchExample(event, "该演示话题尚未建立自然的新闻需求与商品关系，因此没有生成营销内容。")];
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
  if (!highRisk && first.platformContents.xiaohongshu) {
    const hotWeather = /高温|炎热/.test(event);
    first.platformContents.xiaohongshu = hotWeather ? {
      contentAngle: "高温天的外出补水准备",
      title: "高温天出门，先把水放进清单",
      hook: "外出路线可以临时改，喝水这件事最好别等到想起来才准备。",
      content: "出门前看一眼当天要在外待多久，再把饮用水放在容易拿到的位置。\n\n商品资料显示，这款天然饮用水是 550ml 瓶装、12 瓶组合，适合户外日常饮用。需要带多少，按自己的行程安排即可。\n\n这份准备清单里，你还会放什么？",
      tags: ["高温天气", "外出准备", "日常补水"],
      coverText: "外出先准备好水",
      imagePrompt: `日常外出准备场景，自然光，${first.product?.name ?? "瓶装饮用水"}与钥匙和随身包放在桌面；干净留白，不添加促销文字。`,
    } : {
      contentAngle: "出行前的补水清单",
      title: "出发前，先把水放进随身清单",
      hook: "行程排得满满当当，背包里却忘了给饮用水留位置？出发前先检查这一项。",
      content: "安排路线时，也看看当天会在外待多久，把饮用水放在容易拿到的位置。\n\n这款天然饮用水是 550ml 瓶装、12 瓶组合，商品资料注明适合户外日常饮用。是否带上、带多少，按行程和人数安排就好。\n\n你的出行清单里，还有哪件小事容易被漏掉？",
      tags: [event, "出行清单", "日常补水"],
      coverText: "出发前的补水清单",
      imagePrompt: `出行前整理随身包的日常生活场景，自然光，${first.product?.name ?? "瓶装饮用水"}与路线清单一同入镜；构图干净，有留白，不添加促销文字。`,
    };
  }

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
  if (second.platformContents.xiaohongshu) {
    second.platformContents.xiaohongshu = {
      contentAngle: "户外休息时的小食准备",
      title: "周末出门，小食先看人数和口味",
      hook: "户外活动休息时想吃点东西，先想清楚几个人一起吃，再决定带多少。",
      content: "把零食放进清单前，先分清是路上随手吃，还是停下来和同行的人分享。份量合适，比把背包装满更实用。\n\n商品资料显示，每日坚果混合装是 500g 组合，包含腰果、杏仁、核桃仁和果干。若想准备坚果类小食，可以按人数和口味取舍。\n\n你准备户外小食时，会先看口味还是份量？",
      tags: [event, "户外小食", "周末清单"],
      coverText: "周末出门的小食清单",
      imagePrompt: `户外出行前整理背包的自然生活场景，${second.product?.name ?? "混合坚果"}与简单清单放在桌面，自然光，干净留白，不添加促销文字。`,
    };
  }

  return highRisk || /高温|炎热/.test(event) ? [first] : [first, second];
}
