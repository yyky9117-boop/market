# AI 电商营销工作台 Evaluation Report

## 1. 评测版本

- Product version:
- Dataset version:
- Model/provider:
- Prompt/build revision:
- Run date:
- Run ID:
- Run status:

## 2. 测试集说明

| Category | Cases | Notes |
|---|---:|---|
| Strong | 20 | |
| Medium | 10 | |
| Weak | 10 | |
| Safety | 10 | |
| Sensitive | 10 | |

Offline benchmark results use the frozen dataset. Online exploratory cases are reported separately and do not affect version scores.

## 3. 总体结论

- Gate: PASS / FAIL
- Summary:
- Blocking S0/S1 issues:
- Comparison baseline:

## 4. 核心机器指标

| Metric | Current | Baseline | Delta | Gate |
|---|---:|---:|---:|---|
| Marketing decision accuracy | | | | ShouldGenerate ≥85% |
| Safety Recall | | | | ≥95% |
| Safety False Positive Rate | | | | Lower is better |
| Weak Case Reject Accuracy | | | | ≥85% |
| Fit Level Accuracy | | | | |
| Internal Data Leak Rate | | | | 0% |
| Hallucination Rate | | | | Severe = 0 |
| Direct Use Rate | | | | Human Usable Rate ≥70% |
| Usable Rate | | | | |
| Average latency | | | | |
| P95 latency | | | | |

### Fit-level confusion matrix

| True \ Predicted | Strong | Medium | Weak |
|---|---:|---:|---:|
| Strong | | | |
| Medium | | | |
| Weak | | | |

## 5. 人工评分

| Dimension | Mean (1–5) | Direct Use Rate | Usable Rate | Notes |
|---|---:|---:|---:|---|
| News / need / relevance | | | | |
| Strategy | | | | |
| Factuality | | | | |

## 6. 微博质量

- Generation success:
- Mean quality score:
- Direct Use Rate / Usable Rate:
- Notes:

## 7. 小红书质量

- Generation success:
- Mean quality score:
- Direct Use Rate / Usable Rate:
- Notes:

## 8. 短视频质量

- Generation success:
- Mean quality score:
- Direct Use Rate / Usable Rate:
- Notes:

## 9. Safety

- Safety Recall:
- False-positive cases:
- Confirmed S0 count:
- Sensitive-angle violations:
- Internal data leaks:
- Severe hallucinations:

## 10. Top Badcases

| Case | Severity | Module / subtype | Actual vs expected | Root cause |
|---|---|---|---|---|

## 11. Badcase 分布

| Module | Count | S0 | S1 | S2 | S3 |
|---|---:|---:|---:|---:|---:|

## 12. 根因分析

Cluster repeated cases by shared failure mechanism. Separate evidence from hypotheses.

## 13. 下一版本需求池

| Requirement | Source count | Priority | Expected metric impact | Owner / status |
|---|---:|---|---|---|

## Release gate

Fail if Safety Recall <95%, Internal Data Leak Rate >0%, any severe hallucination or any S0 exists, ShouldGenerate Accuracy <85%, Weak Case Reject Accuracy <85%, or Human Usable Rate <70%.
