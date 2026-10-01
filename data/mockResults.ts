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
      consumerNeed,
      productKeyword,
      reason,
    },
    product,
    platformContents: safe ? {
      weibo: {
        title: headline,
        content,
        hashtags,
      },
      xiaohongshu: {
        contentAngle: "出行补给准备",
        title: `${consumerNeed}怎么准备？从一个小场景开始`,
        hook: `${event}相关安排一多，容易顾着行程，却忘了路上最基础的${consumerNeed}。`,
        content: `围绕${event}做准备时，可以先想想自己最常遇到的场景：${consumerNeed}。\n\n像随身补给这种小事，提前理一遍会更从容。${product.name}可以作为一个备选，${product.detail}\n\n具体要不要带、带多少，还是按自己的行程和需要来安排。你出门前最常检查哪一样？`,
        tags: [event, consumerNeed, "生活方式", "出行准备"],
        coverText: `${consumerNeed}准备思路`,
        imagePrompt: `一张自然简约的小红书生活方式摄影。主体为${product.name}，放在与${event}相关的真实生活场景中；采用干净留白构图、柔和自然光和轻松日常氛围，商品以真实包装自然融入画面，不添加促销文字，不展示任何经营数据。`,
      },
      douyin: {
        title: `${event}场景下的${consumerNeed}准备`,
        hook: `${event}的安排里，有一件小事可以提前准备：${consumerNeed}。`,
        scenes: [
          { shot: 1, visual: `镜头展示${event}相关的行程或生活场景，再切到尚未整理的随身物品。`, voiceover: `${event}相关安排开始之前，可以先看看自己会遇到什么消费场景。` },
          { shot: 2, visual: `在桌面或出行准备区放入${product.name}，镜头带到商品详情可确认的信息。`, voiceover: `如果需要${consumerNeed}，可以按实际需要了解这款商品的信息。` },
          { shot: 3, visual: `收好物品后展示整洁的出行准备或日常场景，最后回到商品与清单。`, voiceover: `把适合自己的东西提前安排好，准备起来更有条理。` },
        ],
        cta: `你会为${event}提前准备什么？欢迎评论聊聊。`,
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
        consumerNeed: "当前商品库中暂无对应需求商品",
        productKeyword: "未匹配商品",
        reason: "该示例用于演示商品库没有相关商品时的状态。",
      },
      product: null,
      platformContents: { weibo: null, xiaohongshu: null, douyin: null },
      platformStatuses: { weibo: "not_generated", xiaohongshu: "not_generated", douyin: "not_generated" },
      failureType: "product",
    }];
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
