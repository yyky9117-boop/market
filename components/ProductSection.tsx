import type { Product } from "@/lib/types";

const icons: Record<string, string> = { 饮用水: "💧", 坚果: "🥜", 方便食品: "🍜" };

export default function ProductSection({ product }: { product: Product | null }) {
  return (
    <section className="card-section">
      <div className="section-label"><span className="label-icon">◇</span>推荐商品</div>
      {product ? <>
        <div className="product-box">
          <div className="product-image" aria-hidden="true">{icons[product.subcategory] ?? "📦"}</div>
          <div className="product-copy">
            <p className="product-name">{product.name}</p>
            <div className="product-meta">
              {product.price !== null && <span className="price">¥{product.price.toFixed(2)}</span>}
              {product.rating !== null && <span>★ {product.rating.toFixed(1)}</span>}
            </div>
          </div>
        </div>
        <p className="product-detail">{product.detail}</p>
      </> : <p className="product-detail">当前商品库暂无适合该消费场景的商品。</p>}
    </section>
  );
}
