import type { Product } from "@/lib/types";

export default function ProductSection({ product, analysisFailed = false }: { product: Product | null; analysisFailed?: boolean }) {
  return (
    <section className="card-section">
      <div className="section-label"><span className="label-icon">03</span>匹配商品</div>
      {product ? <>
        <div className="product-box">
          <div className="product-image" aria-hidden="true"><svg width="29" height="29" viewBox="0 0 32 32" fill="none"><path d="M6 11.5 16 6l10 5.5v10.7L16 28 6 22.2V11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M6.7 12 16 17.4 25.3 12M16 17.5V27" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg></div>
          <div className="product-copy">
            <p className="product-name">{product.name}</p>
            <div className="product-meta">
              <span>{product.subcategory}</span>
              {product.price !== null && <span className="price">¥{product.price.toFixed(2)}</span>}
            </div>
          </div>
        </div>
        <p className="product-detail"><span>商品详情</span>{product.detail}</p>
      </> : <p className="product-detail">{analysisFailed ? "新闻分析失败，尚未进行商品匹配。" : "当前商品库暂无适合该消费场景的商品。"}</p>}
    </section>
  );
}
