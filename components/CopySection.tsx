"use client";

import { useState } from "react";
import type { MarketingCopy } from "@/lib/types";

export default function CopySection({ copy, safe, error, failureType }: { copy: MarketingCopy | null; safe: boolean; error?: string; failureType?: "analysis" | "product" | "copy" }) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    if (!copy) return;
    const text = `${copy.headline}\n\n${copy.content}\n\n${copy.hashtags.join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (!copy) {
    return <section className="card-section copy-section">
      <div className="section-label"><span className="label-icon">✎</span>AI 营销文案</div>
      {safe
        ? <span className="copy-error">{error ?? "暂未生成文案。"}</span>
        : <>
            <span className="stopped">{failureType === "analysis" ? "⚠ 风险分析未完成，已暂停文案生成" : "⚠ 已停止生成商业营销文案"}</span>
            {error && failureType !== "analysis" && <p className="copy-error" style={{ marginTop: 8 }}>{error}</p>}
          </>}
    </section>;
  }

  return (
    <section className="card-section copy-section">
      <div className="section-label"><span className="label-icon">✎</span>AI 营销文案</div>
      <h4 className="copy-headline">{copy.headline}</h4>
      <p className="copy-content">{copy.content}</p>
      <div className="hashtags">{copy.hashtags.map((tag) => <span className="hashtag" key={tag}>{tag}</span>)}</div>
      <div style={{ marginTop: 13 }}><button className="copy-button" onClick={copyText} type="button">{copied ? "✓ 已复制" : "▢ 复制文案"}</button></div>
    </section>
  );
}
