# Evaluation v1.1 contract

Business baseline: V1.2.2. Source run and immutable input SHA-256 values are in
`evaluation/manifest_v1.1.json`. All 60 original Case IDs, news and product fixtures
remain identical to v1.0. Changes are label adjudications, not replacement fixtures.

## Separate evidence layers

- `expected` and `originalExpected`: immutable original Golden; never score v1.1 by reading `expected` implicitly.
- `adjudicatedExpected`: explicit final label selection. Unresolved fields retain their original values and are reported as provisional.
- `adjudication`: changed fields, status, human reason, evidence locator, timestamp.
- `machineDetection`: frozen historical set of 29 flags imported by Case ID from the completed workbook.
- `humanVerdict`: final yes/no, disputed/pending, WouldUse applicability and review mode. No fabricated ratings.
- `acceptableProductSkus`: null until human approval with a reason; never auto-expand to actual SKU.
- `rootCause`: original human values plus separate normalized, explicitly confirmed values.

The original 30 workbook headers remain the contract for human answers.
`review-progress.json` is keyed by Case ID, ignored by Git, written through a
cross-process lock and atomic replacement. A tracked import snapshot preserves
the completed 29-case evidence. Explicit adjudications have a separate local file.

## Execution and decisions

An error or incomplete analysis means `error / unknown`. A genuine safety gate
or completed no-natural-product analysis means `success / reject`. A Generate
decision with missing/failed required platforms means `partial / generate`.
Completed Decision Accuracy includes only success with a known decision.
End-to-End Correct Rate uses all 60 cases and requires successful execution and
a correct decision. Content usability is a separate measurement.

Fit-level scoring excludes absent fitLevel rather than fabricating weak. SKU
metrics show the legacy all-case exact hit rate and a separate expected-Generate,
valid-execution denominator. Acceptable SKU reports approved-label coverage.
Semantic relevance uses existing Judge productRelevance, not insertion naturalness.
All rate fields include numerator, denominator and value; empty denominators are null.

## Human completion and freeze

Explicit yes/no final verdicts determine 60-case review progress. Disputed is not
complete. WouldUse is only aggregated on produced content with a filled answer.
Blank scores, severity and text remain blank. Root-cause suggestions never replace
human input. A root cause and severity must be confirmed for every real Badcase.

The baseline stays provisional until 60/60 verdicts, pending Golden adjudications,
real Badcase root causes and missing severities are resolved. Frozen benchmark
labels cannot be edited via the workbench or offline refresh. Add a new dataset
version to change a frozen benchmark.
