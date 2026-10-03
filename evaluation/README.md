# Evaluation v1.0

## Evaluation v1.1 人工校准

v1.0 Dataset、Raw Results、Summary 与完成版人工 Excel 保留为历史证据。
回滚标签：`evaluation-v1.0-complete`。v1.1 当前是未冻结阶段基线，
已有29条明确人工结论，剩余31条通过 `/evaluation` 的全量轻量复核完成。
深度模式仍保留原评分；轻量模式不要求六维评分。

- 初始化：`pnpm eval:calibrate -- --init`（已完成，重复调用不覆盖人工仲裁）。
- 更新快照、阶段报告及候选需求池：页面点击“更新阶段报告”，或运行 `pnpm eval:calibrate`。
- 导出：深度模式导出29条完成版；轻量模式导出60条完成版，附标签仲裁。
- Golden 与可接受 SKU 必须填写人工理由；规范化 Root Cause 单独确认。
- 离线检查：`pnpm eval:check`。

人工答案写入被 Git 忽略的 `review-progress.json`，完成版29条结果已存入
可追溯导入快照。Excel源文件保持只读。JSON 写入使用目录锁与原子替换，
网页保存和命令行刷新共享锁，不丢失并发案例。

剩余31条完成后，解决6条标签仲裁、真实 Badcase 归因及缺失 Severity，
再次更新快照并完成检查、提交变更。然后运行
`pnpm eval:calibrate -- --freeze`，程序检查冻结条件并创建
`evaluation-v1.1-baseline`。未完成时拒绝冻结。已冻结标签禁止刷新和修改。

以后显式授权模型评测时，运行
`pnpm eval -- --dataset evaluation_v1.1 --version v1.2.3`。
v1.1未冻结时不允许版本比较。新运行文件带版本和时间戳，禁止覆盖历史；
历史人工结论不会复用于新版本的输出。本轮只离线重算，没有调用模型或新闻服务。

内部测试可以设置 `EVALUATION_DATA_DIR` 指向评测目录副本，避免修改真实人工进度。

This folder defines a repeatable offline benchmark for the AI e-commerce hotspot marketing pipeline. The fixed benchmark is `dataset/evaluation_v1.json`; CSV is an export for review. Live-news exploration is separate and must not enter benchmark aggregates.

## Baseline status

The `v1.2.2` run is complete: 60 cases were attempted, with three execution errors. The original raw results and summary remain historical evidence. Evaluation v1.1 recalculates metrics offline with explicit execution status and human label adjudication; its current report is provisional until all human reviews and adjudications are complete.

## Included assets

- `dataset/schema.md`: field contract and label policy.
- `metrics.md` and `machineMetrics.mjs`: deterministic metrics, per-case flags, and release gate aggregation.
- `runEvaluation.ts`: replays the fixture news against the currently exported business functions and saves one trace per case. `alias-loader.mjs` lets Node resolve this project's TypeScript `@/` imports without an added runtime dependency.
- `prompts/judgePrompt.ts`: versionable LLM-as-a-Judge prompt.
- `human/human_evaluation_template.csv`: human review fields.
- `taxonomy.md`, `results/badcases.csv`, `backlog/evaluation_backlog.csv`: failure analysis and product backlog workflow.
- `reports/report_template.md`: comparison and release report.
- `resultArtifacts.mjs` and `rebuildArtifacts.mjs`: normalize Judge tags, write readable CSVs/clustered backlog, and refresh deterministic metrics from an already saved raw run without making model calls.

## Run a benchmark

The Runner uses Next.js's bundled `@next/env` loader, so it reads `.env.local` the same way the app does. Use `pnpm eval -- --check-config` to report whether `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` are set without making model calls. Then run `pnpm eval -- --version v1.2.2`. This makes model calls for all 60 fixed cases and the Judge, then writes versioned raw results, a summary, combined results, and the generated badcase rows. `pnpm eval -- --version v1.2.2 --skip-judge` runs the pipeline without Judge calls; such a run cannot pass the human usability gate. Results must only be compared across matching dataset versions.

The runner supplies fixture news directly, then uses the existing news analysis, product matcher, opportunity evaluation, strategy, safety gate, and platform generators. It does not call live search or change production API behavior. Product selection still comes from the model's keywords and current matcher. The original expected SKU is a reference; v1.1 also reports human-approved acceptable SKUs and existing Judge semantic relevance. The runner never updates prompts or production behavior.

Each future run uses the configured model and may incur provider usage charges. This v1.1 calibration only reused the existing run; no new model or news API calls were made.

## Dataset integrity

`dataset/create_v1.mjs` regenerates the JSON and CSV from the curated case definitions and the current mock product catalogue. Run it only when intentionally creating the frozen dataset; review the diff and bump the dataset version for label or case changes. Always preserve the prior version.
