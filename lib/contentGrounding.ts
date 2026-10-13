import type { NewsItem, SanitizedProduct } from "@/lib/types";

function positiveText(text: string): string {
  return text.replace(/(?:不得|禁止|不能|不要|避免|不应|不宣称|不承诺)[^。！？;；\n"“”]*/g, "");
}

export function usesSensitiveMarketingHook(text: string): boolean {
  return /ADHD|抑郁|焦虑症|心理健康|精神健康|儿童心理|儿童健康|儿童发育|疾病|诊断|药物|医疗|视力筛查|近视|心理问题|情绪问题/i.test(positiveText(text));
}

function mentionsPrice(text: string): boolean {
  return /(?:价格|售价|价位|到手价|原价|现价|标价|定价|性价比|人民币|rmb|cny|\b(?:usd|eur)\b)|[¥￥$]\s*\d|\d+(?:[.,]\d+)?\s*(?:元|块(?:钱)?|角|毛)(?![a-z])|[零一二三四五六七八九十百千万两]+\s*(?:元|块钱)/i.test(text);
}

// Narrow guards for observed unsupported claims, not a general factuality judge.
export function groundingIssues(text: string, news: NewsItem, product: SanitizedProduct): string[] {
  const positive = positiveText(text);
  const sources = `${news.title} ${news.brief} ${product.detail}`;
  const issues: string[] = [];
  if (mentionsPrice(text)) issues.push("消费者文案不得出现价格或价格话术");
  for (const claim of positive.match(/翻倍|增长\s*\d+(?:\.\d+)?%|提升\s*\d+(?:\.\d+)?%/g) ?? []) {
    if (!sources.includes(claim)) issues.push(`缺少来源的量化表述：${claim}`);
  }
  for (const claim of positive.match(/省液|省收纳空间|(?:减少|避免|防止)[^，。；\n]{0,12}(?:发黄|异味)/g) ?? []) {
    if (!product.detail.includes(claim)) issues.push(`商品详情未支持的效果：${claim}`);
  }
  return [...new Set(issues)];
}
