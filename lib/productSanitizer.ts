import type { Product, SanitizedProduct } from "@/lib/types";

/** Explicit allow-list: only consumer-facing fields cross into the copy model. */
export function sanitizeProductForCopy(product: Product): SanitizedProduct {
  return {
    name: product.name,
    detail: product.detail,
  };
}
