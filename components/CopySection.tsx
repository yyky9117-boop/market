"use client";

import { useState } from "react";
import type { PlatformContents, PlatformErrors, PlatformKey, PlatformStatuses } from "@/lib/types";

const tabs: Array<{ key: PlatformKey; label: string }> = [
  { key: "weibo", label: "微博" },
  { key: "xiaohongshu", label: "小红书" },
  { key: "douyin", label: "短视频" },
];

export default function CopySection({
  contents,
  statuses,
  errors = {},
  safe,
  productAvailable,
  failureType,
}: {
  contents: PlatformContents;
  statuses: PlatformStatuses;
  errors?: PlatformErrors;
  safe: boolean;
  productAvailable: boolean;
  failureType?: "analysis" | "product";
}) {
  const [active, setActive] = useState<PlatformKey>("weibo");
  const [copied, setCopied] = useState("");

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  const status = statuses[active];
  const tabStatus = (key: PlatformKey) => statuses[key] === "success"
    ? "已生成"
    : statuses[key] === "failed"
      ? "失败"
      : statuses[key] === "loading"
        ? "生成中"
        : "";

  function copyButton(key: string, text: string, label: string) {
    return <button className="copy-button" onClick={() => void copyText(key, text)} type="button">
      {copied === key ? "✓ 已复制" : `▢ ${label}`}
    </button>;
  }

  return (
    <section className="card-section copy-section">
      <div className="section-label"><span className="label-icon">✎</span>多平台营销内容</div>
      <div className="platform-tabs" role="tablist" aria-label="选择内容平台">
        {tabs.map((tab) => <button
          key={tab.key}
          id={`${tab.key}-tab`}
          className={`platform-tab${active === tab.key ? " active" : ""}`}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          aria-controls={`${tab.key}-panel`}
          onClick={() => setActive(tab.key)}
        >
          {tab.label}{tabStatus(tab.key) && <small className={`platform-status ${statuses[tab.key]}`}>{tabStatus(tab.key)}</small>}
        </button>)}
      </div>
      <div className="platform-panel" role="tabpanel" id={`${active}-panel`} aria-labelledby={`${active}-tab`}>
        {status === "loading" ? <p className="copy-error">正在生成该平台内容…</p>
          : status === "failed" ? <p className="copy-error">{errors[active] ?? "生成失败，请稍后重试。"}</p>
            : status === "not_generated" ? <div className="platform-empty">
                {!safe || failureType === "analysis"
                  ? <><strong>不建议商业营销</strong><span>热点风险较高或分析未完成，已停止生成所有平台内容。</span></>
                  : !productAvailable || failureType === "product"
                    ? <><strong>当前商品库暂无适合该消费场景的商品</strong><span>已跳过平台内容生成。</span></>
                    : <><strong>平台内容未生成</strong><span>可重新分析后再试。</span></>}
              </div>
              : active === "weibo" && contents.weibo ? <>
                  <h4 className="copy-headline">{contents.weibo.title}</h4>
                  <p className="copy-content">{contents.weibo.content}</p>
                  <div className="hashtags">{contents.weibo.hashtags.map((tag, index) => <span className="hashtag" key={`${tag}-${index}`}>{tag}</span>)}</div>
                  <div className="platform-actions">{copyButton("weibo", `${contents.weibo.title}\n\n${contents.weibo.content}\n\n${contents.weibo.hashtags.join(" ")}`, "复制微博文案")}</div>
                </>
                : active === "xiaohongshu" && contents.xiaohongshu ? <>
                    <h4 className="copy-headline">{contents.xiaohongshu.title}</h4>
                    <p className="copy-content">{contents.xiaohongshu.content}</p>
                    <div className="hashtags">{contents.xiaohongshu.tags.map((tag, index) => <span className="hashtag" key={`${tag}-${index}`}>#{tag.replace(/^#/, "")}</span>)}</div>
                    <div className="platform-extra"><span>封面文案</span><strong>{contents.xiaohongshu.coverText}</strong>{copyButton("xhs-cover", contents.xiaohongshu.coverText, "复制封面文案")}</div>
                    <details className="image-prompt"><summary>展开配图建议</summary><p>{contents.xiaohongshu.imagePrompt}</p>{copyButton("xhs-image", contents.xiaohongshu.imagePrompt, "复制配图 Prompt")}</details>
                    <div className="platform-actions">{copyButton("xiaohongshu", `${contents.xiaohongshu.title}\n\n${contents.xiaohongshu.content}\n\n${contents.xiaohongshu.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}`, "复制笔记")}</div>
                  </>
                  : active === "douyin" && contents.douyin ? <>
                      <h4 className="copy-headline">{contents.douyin.title}</h4>
                      <div className="script-hook"><span>3 秒钩子</span>{contents.douyin.hook}</div>
                      <div className="script-scenes">{contents.douyin.scenes.map((scene) => <div className="script-scene" key={scene.shot}>
                        <strong>镜头 {scene.shot}</strong><p><span>画面</span>{scene.visual}</p><p><span>口播</span>{scene.voiceover}</p>
                      </div>)}</div>
                      <div className="script-cta"><span>CTA</span>{contents.douyin.cta}</div>
                      <div className="platform-actions">{copyButton("douyin", `${contents.douyin.title}\n\n3 秒钩子：${contents.douyin.hook}\n\n${contents.douyin.scenes.map((scene) => `镜头 ${scene.shot}\n画面：${scene.visual}\n口播：${scene.voiceover}`).join("\n\n")}\n\nCTA：${contents.douyin.cta}`, "复制完整脚本")}</div>
                    </>
                    : <p className="copy-error">该平台暂时没有可展示的内容。</p>}
      </div>
    </section>
  );
}
