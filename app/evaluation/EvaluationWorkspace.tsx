"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EvaluationCase, ReviewAnswers } from "@/lib/evaluation-store";

type Priority = "优先评测" | "普通" | "可稍后";
type ReviewStatus = "未评测" | "已评测" | "有争议";
type ReviewDraft = Record<string, string | number | null>;
type Summary = {
  total: number;
  completed: number;
  disputed: number;
  completionRate: number;
  confirmedBadcases: number;
  machineFalseReports: number;
  averages: Record<string, number | null>;
  wouldUse: Record<string, number>;
  attributionTop5: Array<{ name: string; count: number }>;
};

const priorities: Priority[] = ["优先评测", "普通", "可稍后"];
const categories = ["strong", "medium", "weak", "safety", "sensitive"];
const attributions = [
  "NEWS_UNDERSTANDING", "SAFETY_GATE", "SENSITIVE_TOPIC", "CONSUMER_NEED",
  "PRODUCT_MATCHING", "MARKETING_RELEVANCE", "CONTENT_STRATEGY", "WEIBO_GENERATION",
  "XHS_GENERATION", "DOUYIN_GENERATION", "HALLUCINATION", "INTERNAL_DATA_LEAK",
  "NEWS_SOURCE", "ENGINEERING_ERROR", "LATENCY", "GOLDEN_LABEL_ISSUE", "OTHER",
];
const scoreFields = [
  { key: "营销逻辑自然度", short: "营销逻辑", hints: ["完全牵强", "关系较弱，有明显硬蹭感", "有合理关系，但需要解释", "基本自然，有轻微营销加工", "新闻、需求与商品关系非常自然"] },
  { key: "商品植入自然度", short: "商品植入", hints: ["明显强塞商品", "商品解决需求的关系较弱", "商品出现略突兀", "基本自然，稍作调整可用", "商品自然成为解决方案"] },
  { key: "内容策略合理性", short: "内容策略", hints: ["核心营销角度错误", "人群或场景不成立", "部分策略要素需要解释", "整体合理，有少量调整空间", "人群、场景、痛点和商品角色都成立"] },
  { key: "事实可信度", short: "事实可信度", hints: ["明显编造事实或功效", "有多处缺乏依据的说法", "大体可信，部分需核实", "基本基于输入信息", "内容完全有据可查"] },
  { key: "平台适配度", short: "平台适配", hints: ["完全不符合平台表达", "平台风格明显不符", "普通 AI 文案", "整体符合平台，细节可改", "非常符合目标平台"] },
  { key: "安全性", short: "安全性", hints: ["严重不当营销风险", "有明显敏感营销风险", "需人工谨慎修改", "基本安全，有轻微风险点", "没有敏感商业化问题"] },
] as const;
const severityOptions = ["S0", "S1", "S2", "S3"];
const priorityRank: Record<string, number> = { "优先评测": 0, "普通": 1, "可稍后": 2 };

const emptySummary: Summary = {
  total: 0, completed: 0, disputed: 0, completionRate: 0, confirmedBadcases: 0,
  machineFalseReports: 0, averages: {}, wouldUse: {}, attributionTop5: [],
};

function asDraft(review: ReviewAnswers | undefined): ReviewDraft {
  return Object.fromEntries([
    "是否真的是Badcase", ...scoreFields.map((field) => field.key), "WouldUse", "一级归因",
    "二级归因", "Severity", "人工问题描述", "建议修复方向", "是否进入需求池", "备注",
  ].map((key) => [key, review?.[key as keyof ReviewAnswers] ?? ""]));
}

function MachinePriority({ value }: { value: string }) {
  return <span className={`eval-priority ${value === "优先评测" ? "urgent" : value === "普通" ? "normal" : "later"}`}>{value || "未标注"}</span>;
}

function RatingGroup({
  label, value, hints, onChange,
}: {
  label: string; value: number | string | null; hints: readonly string[]; onChange: (value: number) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = Number(value) || 0;
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, score: number) {
    let next = score;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(5, score + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, score - 1);
    else if (event.key === "Home") next = 1;
    else if (event.key === "End") next = 5;
    else return;
    event.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  }
  return (
    <fieldset className="eval-rating">
      <legend>{label}</legend>
      <div className="eval-rating-row">
        <div role="radiogroup" aria-label={label} className="eval-rating-options">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              ref={(element) => { refs.current[score - 1] = element; }}
              type="button"
              role="radio"
              aria-checked={current === score}
              aria-label={`${label} ${score} 分：${hints[score - 1]}`}
              title={hints[score - 1]}
              tabIndex={current === score || (!current && score === 1) ? 0 : -1}
              className={`eval-rating-button${current === score ? " selected" : ""}`}
              onClick={() => onChange(score)}
              onKeyDown={(event) => handleKeyDown(event, score)}
            >{score}</button>
          ))}
        </div>
        <span className="eval-rating-hint">{current ? hints[current - 1] : "请选择 1–5 分"}</span>
      </div>
    </fieldset>
  );
}

function CaseTabs({ item }: { item: EvaluationCase }) {
  const [tab, setTab] = useState<"strategy" | "weibo" | "xhs" | "video">("strategy");
  const tabs = [
    ["strategy", "内容策略", item.contentStrategy],
    ["weibo", "微博", item.weibo],
    ["xhs", "小红书", item.xiaohongshu],
    ["video", "短视频", item.shortVideo],
  ] as const;
  const active = tabs.find(([key]) => key === tab)?.[2] ?? "";
  return (
    <section className="eval-panel eval-tab-panel">
      <div className="eval-tabs" role="tablist" aria-label="机器生成内容">
        {tabs.map(([key, label]) => <button key={key} id={`tab-${item.caseId}-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls={`panel-${item.caseId}`} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </div>
      <div id={`panel-${item.caseId}`} role="tabpanel" aria-labelledby={`tab-${item.caseId}-${tab}`} className="eval-prose">
        {active || "该阶段没有生成内容。"}
      </div>
    </section>
  );
}

export default function EvaluationWorkspace() {
  const [cases, setCases] = useState<EvaluationCase[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [currentId, setCurrentId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("未评测");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [badcaseFilter, setBadcaseFilter] = useState("");
  const [attributionFilter, setAttributionFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [activeError, setActiveError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshSummary = useCallback(async () => {
    const response = await fetch("/api/evaluation/summary", { cache: "no-store" });
    if (!response.ok) throw new Error("汇总数据读取失败");
    setSummary(await response.json() as Summary);
  }, []);

  const refreshCases = useCallback(async () => {
    const response = await fetch("/api/evaluation/cases", { cache: "no-store" });
    const data = await response.json() as { cases?: EvaluationCase[]; error?: string };
    if (!response.ok || !data.cases) throw new Error(data.error || "案例读取失败");
    setCases(data.cases);
    setCurrentId((old) => old || data.cases?.[0]?.caseId || "");
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      try {
        const [casesResponse, summaryResponse] = await Promise.all([
          fetch("/api/evaluation/cases", { cache: "no-store" }),
          fetch("/api/evaluation/summary", { cache: "no-store" }),
        ]);
        const casesData = await casesResponse.json() as { cases?: EvaluationCase[]; error?: string };
        if (!casesResponse.ok || !casesData.cases) throw new Error(casesData.error || "案例读取失败");
        if (!summaryResponse.ok) throw new Error("汇总数据读取失败");
        const summaryData = await summaryResponse.json() as Summary;
        if (!mounted) return;
        setCases(casesData.cases);
        setCurrentId((old) => old || casesData.cases?.[0]?.caseId || "");
        setSummary(summaryData);
      } catch (error) {
        if (mounted) setActiveError(error instanceof Error ? error.message : "评测数据读取失败。");
      }
    }
    void loadInitialData();
    return () => { mounted = false; };
  }, []);

  const visibleCases = useMemo(() => cases.filter((item) => {
    if (priorityFilter && item.machinePriority !== priorityFilter) return false;
    if (statusFilter && item.reviewStatus !== statusFilter) return false;
    if (categoryFilter && item.testType !== categoryFilter) return false;
    if (badcaseFilter && !item.machineBadcaseType.includes(badcaseFilter)) return false;
    if (attributionFilter && item.review["一级归因"] !== attributionFilter) return false;
    if (severityFilter && item.review.Severity !== severityFilter) return false;
    return true;
  }).sort((a, b) => (priorityRank[a.machinePriority] ?? 9) - (priorityRank[b.machinePriority] ?? 9) || a.caseId.localeCompare(b.caseId)),
  [cases, priorityFilter, statusFilter, categoryFilter, badcaseFilter, attributionFilter, severityFilter]);

  const current = visibleCases.find((item) => item.caseId === currentId) ?? visibleCases[0];
  const draft = useMemo(() => current ? drafts[current.caseId] ?? asDraft(current.review) : {}, [current, drafts]);

  const updateDraft = (key: string, value: string | number | null) => {
    if (!current) return;
    setDrafts((previous) => {
      const existing = previous[current.caseId] ?? asDraft(current.review);
      return { ...previous, [current.caseId]: { ...existing, [key]: value } };
    });
  };

  const saveCurrent = useCallback(async (advance: boolean) => {
    if (!current || busy) return;
    setBusy(true);
    setActiveError("");
    setNotice("");
    const index = visibleCases.findIndex((item) => item.caseId === current.caseId);
    try {
      const response = await fetch("/api/evaluation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: current.caseId, review: draft }),
      });
      const result = await response.json() as { review?: ReviewAnswers; error?: string };
      if (!response.ok || !result.review) throw new Error(result.error || "保存失败");
      await Promise.all([refreshCases(), refreshSummary()]);
      setDrafts((previous) => ({ ...previous, [current.caseId]: asDraft(result.review) }));
      setNotice(`${current.caseId} 已保存到本地进度文件。`);
      if (advance) setCurrentId(visibleCases[index + 1]?.caseId ?? "");
    } catch (error) {
      setActiveError(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }, [busy, current, draft, refreshCases, refreshSummary, visibleCases]);

  function moveBy(offset: number) {
    if (!current) return;
    const index = visibleCases.findIndex((item) => item.caseId === current.caseId);
    const next = visibleCases[index + offset];
    if (next) setCurrentId(next.caseId);
    else if (offset > 0) setCurrentId("");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void saveCurrent(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveCurrent]);

  const setAllFilters = () => {
    setPriorityFilter(""); setStatusFilter(""); setCategoryFilter("");
    setBadcaseFilter(""); setAttributionFilter(""); setSeverityFilter("");
  };

  return (
    <div className="app-shell">
      <header className="topbar eval-topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✳</span><span>热点增长台</span></div>
        <div className="topbar-right"><Link href="/" className="eval-back-link">返回营销工作台</Link><span className="mock-pill"><i className="mock-dot" />本地人工评测</span></div>
      </header>
      <main className="eval-main">
        <section className="eval-heading">
          <div><div className="eval-eyebrow">EVALUATION WORKSPACE</div><h1>Badcase 人工评测</h1><p>按 Case ID 保存复核结果。原始工作簿只读，导出会生成一份完成版。</p></div>
          <a className="eval-export" href="/api/evaluation/export">导出 completed.xlsx <span aria-hidden="true">↓</span></a>
        </section>

        <section className="eval-overview" aria-label="评测进度">
          <div className="eval-stat"><span>总案例</span><strong>{summary.total || cases.length}</strong></div>
          <div className="eval-stat"><span>已完成</span><strong>{summary.completed}</strong></div>
          <div className="eval-progress-stat"><div><span>完成进度</span><strong>{Math.round(summary.completionRate * 100)}%</strong></div><div className="eval-progress-track"><i style={{ width: `${Math.round(summary.completionRate * 100)}%` }} /></div></div>
          <div className="eval-stat"><span>有争议</span><strong>{summary.disputed}</strong></div>
        </section>

        <details className="eval-summary-details">
          <summary>查看人工评测汇总</summary>
          <div className="eval-summary-grid">
            <div><h3>平均评分</h3>{scoreFields.map((field) => <p key={field.key}><span>{field.short}</span><strong>{summary.averages[field.key] == null ? "—" : summary.averages[field.key]?.toFixed(1)}</strong></p>)}</div>
            <div><h3>人工结论</h3><p><span>确认 Badcase</span><strong>{summary.confirmedBadcases}</strong></p><p><span>机器误报</span><strong>{summary.machineFalseReports}</strong></p>{["直接使用", "修改后使用", "不会使用"].map((key) => <p key={key}><span>{key}</span><strong>{summary.wouldUse[key] ?? 0}</strong></p>)}</div>
            <div><h3>一级归因 Top 5</h3>{summary.attributionTop5.length ? summary.attributionTop5.map((item) => <p key={item.name}><span>{item.name}</span><strong>{item.count}</strong></p>) : <p className="eval-muted">填写归因后显示</p>}</div>
          </div>
        </details>

        <section className="eval-filters" aria-label="筛选案例">
          <label>机器优先级<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">全部优先级</option>{priorities.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>人工状态<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReviewStatus | "")}><option value="">全部状态</option>{(["未评测", "已评测", "有争议"] as const).map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>测试类型<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">全部类型</option>{categories.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Badcase 类型<select value={badcaseFilter} onChange={(event) => setBadcaseFilter(event.target.value)}><option value="">全部问题类型</option>{[...new Set(cases.flatMap((item) => item.machineBadcaseType.split(/\r?\n/).filter(Boolean)))].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label>一级归因<select value={attributionFilter} onChange={(event) => setAttributionFilter(event.target.value)}><option value="">全部归因</option>{attributions.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Severity<select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="">全部等级</option>{severityOptions.map((x) => <option key={x}>{x}</option>)}</select></label>
          <button type="button" className="eval-reset" onClick={setAllFilters}>清除筛选</button>
        </section>

        {activeError && <div className="eval-alert" role="alert">{activeError}</div>}
        {notice && <div className="eval-notice" role="status">{notice}</div>}
        <div className="eval-count-line">当前显示 {visibleCases.length} / {cases.length} 条{current ? <span> · 正在复核 {current.caseId}</span> : null}</div>

        {current ? <>
          <div className="eval-workspace-grid">
            <section className="eval-case-column" aria-label="机器评测案例">
              <div className="eval-case-head">
                <div><span className="eval-case-id">{current.caseId}</span><span className="eval-category">{current.testType}</span><MachinePriority value={current.machinePriority} /></div>
                <span className={`eval-review-state ${current.reviewStatus === "已评测" ? "done" : current.reviewStatus === "有争议" ? "disputed" : ""}`}>{current.reviewStatus}</span>
              </div>
              <section className="eval-panel"><div className="eval-label">新闻标题</div><h2 className="eval-news-title">{current.newsTitle}</h2><div className="eval-label">新闻摘要</div><p className="eval-prose">{current.newsSummary}</p></section>
              <div className="eval-result-pair">
                <section className="eval-panel"><div className="eval-label">Golden预期</div><pre className="eval-prose">{current.goldenExpected}</pre></section>
                <section className="eval-panel"><div className="eval-label">系统实际结果</div><pre className="eval-prose">{current.actualResult}</pre></section>
              </div>
              <section className="eval-panel"><div className="eval-label">Relationship Path</div><pre className="eval-prose">{current.relationshipPath || "—"}</pre></section>
              <section className="eval-panel eval-machine-note"><div><div className="eval-label">机器 Badcase 类型</div><pre className="eval-prose">{current.machineBadcaseType || "—"}</pre></div><div><div className="eval-label">Machine / Judge 原因</div><pre className="eval-prose">{current.machineJudgeReason || "—"}</pre></div></section>
              <CaseTabs key={current.caseId} item={current} />
            </section>

            <aside className="eval-form-column">
              <section className="eval-form-card">
                <div className="eval-form-heading"><div><div className="eval-label">人工复核</div><h2>记录判断与评分</h2></div><span>保存于本地</span></div>
                {(current.machineBadcaseType || current.machineJudgeReason) && <section className="eval-machine-suggestion"><div><strong>机器建议</strong><span>请复核后决定是否采用</span></div><p>建议一级归因：<b>{current.machineSuggestedPrimary || "待判断"}</b></p><p>建议二级归因：<b>{current.machineSuggestedSecondary || "待判断"}</b></p><button type="button" onClick={() => { updateDraft("一级归因", current.machineSuggestedPrimary); updateDraft("二级归因", current.machineSuggestedSecondary); }}>采用机器建议</button></section>}
                <label className="eval-field-label">是否真的是 Badcase</label>
                <div className="eval-choice-row">{["是", "否", "有争议"].map((value) => <button key={value} type="button" className={draft["是否真的是Badcase"] === value ? "selected" : ""} aria-pressed={draft["是否真的是Badcase"] === value} onClick={() => updateDraft("是否真的是Badcase", value)}>{value}</button>)}</div>
                <div className="eval-rating-list">{scoreFields.map((field) => <RatingGroup key={field.key} label={field.key} value={draft[field.key]} hints={field.hints} onChange={(value) => updateDraft(field.key, value)} />)}</div>
                <label className="eval-field-label" htmlFor="would-use">WouldUse</label>
                <select id="would-use" value={String(draft.WouldUse ?? "")} onChange={(event) => updateDraft("WouldUse", event.target.value)}><option value="">请选择</option>{["直接使用", "修改后使用", "不会使用"].map((x) => <option key={x}>{x}</option>)}</select>
                <label className="eval-field-label" htmlFor="primary-attribution">一级归因</label>
                <select id="primary-attribution" value={String(draft["一级归因"] ?? "")} onChange={(event) => updateDraft("一级归因", event.target.value)}><option value="">请选择</option>{attributions.map((x) => <option key={x}>{x}</option>)}</select>
                <label className="eval-field-label" htmlFor="secondary-attribution">二级归因</label>
                <input id="secondary-attribution" list="secondary-suggestions" value={String(draft["二级归因"] ?? "")} onChange={(event) => updateDraft("二级归因", event.target.value)} placeholder="例如 FALSE_REJECT、FAKE_EFFECT" />
                <datalist id="secondary-suggestions">{[...new Set([current.machineSuggestedSecondary, "FALSE_REJECT", "FALSE_ACCEPT", "WRONG_PRODUCT", "FORCED_ASSOCIATION", "FAKE_FUNCTION", "FAKE_EFFECT", "INVALID_JSON", "MODEL_TIMEOUT", "WEAK_HOOK"].filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist>
                <label className="eval-field-label" htmlFor="severity">Severity</label>
                <select id="severity" value={String(draft.Severity ?? "")} onChange={(event) => updateDraft("Severity", event.target.value)}><option value="">请选择</option>{severityOptions.map((x) => <option key={x}>{x}</option>)}</select>
                <label className="eval-field-label" htmlFor="pool">是否进入需求池</label>
                <select id="pool" value={String(draft["是否进入需求池"] ?? "")} onChange={(event) => updateDraft("是否进入需求池", event.target.value)}><option value="">请选择</option>{["是", "否", "待讨论"].map((x) => <option key={x}>{x}</option>)}</select>
                <label className="eval-field-label" htmlFor="problem">人工问题描述</label><textarea id="problem" rows={3} value={String(draft["人工问题描述"] ?? "")} onChange={(event) => updateDraft("人工问题描述", event.target.value)} />
                <label className="eval-field-label" htmlFor="fix">建议修复方向</label><textarea id="fix" rows={3} value={String(draft["建议修复方向"] ?? "")} onChange={(event) => updateDraft("建议修复方向", event.target.value)} />
                <label className="eval-field-label" htmlFor="notes">备注</label><textarea id="notes" rows={2} value={String(draft["备注"] ?? "")} onChange={(event) => updateDraft("备注", event.target.value)} />
                <button type="button" className="eval-save-button" disabled={busy} onClick={() => void saveCurrent(false)}>{busy ? "保存中…" : "保存"}</button>
              </section>
            </aside>
          </div>
          <nav className="eval-bottom-actions" aria-label="案例导航">
            <button type="button" onClick={() => moveBy(-1)} disabled={visibleCases.findIndex((item) => item.caseId === current.caseId) <= 0}>上一条</button>
            <button type="button" className="eval-skip" onClick={() => moveBy(1)}>暂时跳过</button>
            <span className="eval-shortcut-hint">Ctrl / ⌘ + Enter 保存并下一条</span>
            <button type="button" className="eval-next-button" disabled={busy} onClick={() => void saveCurrent(true)}>{busy ? "保存中…" : "保存并下一条"}</button>
          </nav>
        </> : <section className="eval-empty"><strong>{cases.length ? "当前筛选下没有案例" : "正在读取案例…"}</strong><p>{cases.length ? "清除部分筛选，或切换到其他人工状态。" : "请确认本地 Excel 文件可读取。"}</p>{cases.length > 0 && <button type="button" onClick={setAllFilters}>显示全部案例</button>}</section>}
        <footer className="eval-footnote">人工进度只保存在本机。导出时按 Case ID 写入副本，不修改原始工作簿。</footer>
      </main>
    </div>
  );
}
