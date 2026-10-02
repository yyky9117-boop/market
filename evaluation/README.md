# Evaluation v1.0

This folder defines a repeatable offline benchmark for the AI e-commerce hotspot marketing pipeline. The fixed benchmark is `dataset/evaluation_v1.json`; CSV is an export for review. Live-news exploration is separate and must not enter benchmark aggregates.

## Baseline status

The first baseline is intended to be the current product version `v1.2.2`. The checked-in result and summary files are explicitly `not_run` with null scores. No baseline score is claimed until every fixture has been run against a configured model and the run metadata has been recorded.

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

The runner supplies fixture news directly, then uses the existing news analysis, product matcher, opportunity evaluation, strategy, safety gate, and platform generators. It does not call live search or change production API behavior. Product selection still comes from the model's keywords and current matcher; expected SKU is the match ground truth. The runner never updates prompts or production behavior.

Each call uses the configured model and may incur provider usage charges. The checked-in baseline remains `not_run` until a benchmark is intentionally launched; no network/model evaluation was performed while building these assets.

## Dataset integrity

`dataset/create_v1.mjs` regenerates the JSON and CSV from the curated case definitions and the current mock product catalogue. Run it only when intentionally creating the frozen dataset; review the diff and bump the dataset version for label or case changes. Always preserve the prior version.
