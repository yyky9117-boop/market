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

export function matchProducts(keyword: string, products: Product[]): Product | null {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  const terms = splitTerms(keyword);
  if (!normalizedKeyword || products.length === 0) return null;

  const ranked = products
    .filter((product) => product.stock === null || product.stock === undefined || product.stock > 0)
    .map((product) => {
      const fields = {
        name: product.name.toLocaleLowerCase(),
        subcategory: product.subcategory.toLocaleLowerCase(),
        category: product.category.toLocaleLowerCase(),
        detail: product.detail.toLocaleLowerCase(),
      };
      let score = 0;

      if (fields.name.includes(normalizedKeyword)) score += 10;
      if (fields.subcategory.includes(normalizedKeyword)) score += 9;
      if (fields.category.includes(normalizedKeyword)) score += 7;
      if (fields.detail.includes(normalizedKeyword)) score += 4;

      for (const term of terms) {
        if (term.length < 2) continue;
        if (fields.name.includes(term)) score += 3;
        if (fields.subcategory.includes(term)) score += 3;
        if (fields.category.includes(term)) score += 2;
        if (fields.detail.includes(term)) score += 1;
      }

      // Existing sales metrics are internal ranking signals only.
      const salesTieBreak = Math.min(product.monthlySales ?? 0, 10_000) / 10_000;
      return { product, score, salesTieBreak };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || right.salesTieBreak - left.salesTieBreak);

  return ranked[0]?.product ?? null;
}
