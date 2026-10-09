import type { Product } from "@/lib/types";

function splitTerms(keyword: string): string[] {
  const normalized = keyword.trim().toLocaleLowerCase();
  if (!normalized) return [];

  const separated = normalized.split(/[\s,，、/|;；]+/).filter(Boolean);
  const terms = new Set(separated);
  for (const term of separated) {
    if (/^[\u3400-\u9fff]+$/.test(term) && term.length >= 4) {
      for (let index = 0; index < term.length - 1; index += 1) {
        terms.add(term.slice(index, index + 2));
      }
    }
  }
  return [...terms];
}

// Retrieval aliases do not authorize calling ordinary drinking water mineral water in copy.
const searchAliases = [
  ["瓶装水", "矿泉水", "饮用水"],
  ["阅读灯", "学习台灯", "台灯"],
] as const;
const genericTerms = new Set(["儿童", "孩子", "学生", "家庭", "日常", "食品", "生活", "用品", "产品", "便携", "户外", "运动", "健康", "学习"]);

export function rankProducts(keyword: string | string[], products: Product[], limit = 3): Product[] {
  const keywords = (Array.isArray(keyword) ? keyword : [keyword])
    .map((item) => item.trim().toLocaleLowerCase())
    .filter(Boolean);
  const expanded = [...new Set(keywords.flatMap(item => {
    const group = searchAliases.find(group => group.some(term => item.includes(term)));
    return group ? [item, ...group] : [item];
  }))];
  const terms = [...new Set(expanded.flatMap(splitTerms))].filter(term => !genericTerms.has(term));
  if (keywords.length === 0 || products.length === 0) return [];

  const ranked = products
    .filter((product) => product.stock === null || product.stock === undefined || product.stock > 0)
    .map((product) => {
      const fields = {
        name: product.name.toLocaleLowerCase(),
        subcategory: product.subcategory.toLocaleLowerCase(),
        detail: product.detail.toLocaleLowerCase(),
      };
      let score = 0;

      for (const item of expanded) {
        if (genericTerms.has(item)) continue;
        if (fields.name.includes(item)) score += 10;
        if (fields.subcategory.includes(item)) score += 9;
        if (fields.detail.includes(item)) score += 4;
      }

      for (const term of terms) {
        if (term.length < 2) continue;
        if (fields.name.includes(term)) score += 3;
        if (fields.subcategory.includes(term)) score += 3;
        if (fields.detail.includes(term)) score += 1;
      }

      // Broad categories such as 食品饮料 are not evidence that a SKU meets a need.
      // Sales cannot make a semantically unrelated product eligible.
      return { product, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.product.sku.localeCompare(right.product.sku));

  return ranked.slice(0, Math.max(0, limit)).map(candidate => candidate.product);
}

export function matchProducts(keyword: string | string[], products: Product[]): Product | null {
  return rankProducts(keyword, products, 1)[0] ?? null;
}
