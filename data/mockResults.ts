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
    copy: safe
      ? { headline, content, marketingAngle, hashtags }
      : null,
  };
}

export function getMockResults(query: string): GenerateResultItem[] {
  const highRisk = /地震|灾害|洪水|事故|伤亡|火灾|台风|泥石流/.test(query);
  const event = query.trim();

  const first = createItem(
    "1",
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
