# Badcase Taxonomy

Use one primary module and one specific subtype per issue. Add a second record only when the issue has a genuinely separate root cause. Do not use vague labels such as “bad copy”.

| Module | Subtypes |
|---|---|
| `NEWS_UNDERSTANDING` | `MISREAD_EVENT`, `MISSED_CONTEXT`, `INVENTED_NEWS_FACT`, `WRONG_CONSUMER_NEED` |
| `SAFETY_GATE` | `UNSAFE_GENERATION`, `FALSE_SAFETY_BLOCK`, `RISK_LEVEL_MISCLASSIFIED`, `SAFETY_GATE_BYPASS` |
| `SENSITIVE_TOPIC` | `SENSITIVE_TOPIC_MISSED`, `SENSITIVE_COMMERCIAL_HOOK`, `UNSUPPORTED_HEALTH_CLAIM`, `SAFE_ANGLE_OVERBLOCKED` |
| `CONSUMER_NEED` | `FAKE_PAIN_POINT`, `NEED_NOT_NEWS_GROUNDED`, `NEED_TOO_GENERIC` |
| `PRODUCT_MATCHING` | `WRONG_PRODUCT`, `NO_MATCH_WHEN_VALID`, `MATCHED_IRRELEVANT_PRODUCT`, `INTERNAL_SIGNAL_LEAK` |
| `MARKETING_RELEVANCE` | `RELATION_TOO_LONG`, `FORCED_ASSOCIATION`, `FIT_SCORE_TOO_HIGH`, `FIT_SCORE_TOO_LOW`, `WRONG_FIT_LEVEL`, `WRONG_GENERATE_DECISION` |
| `CONTENT_STRATEGY` | `WRONG_AUDIENCE`, `WRONG_SCENE`, `FAKE_PAIN_POINT`, `HARD_SELL_ANGLE`, `SENSITIVE_ANGLE`, `STRATEGY_NOT_PRODUCT_GROUNDED` |
| `WEIBO_GENERATION` | `WEAK_HOOK`, `OFF_PLATFORM_TONE`, `TOO_AD_LIKE`, `POOR_HASHTAGS`, `POOR_TITLE` |
| `XHS_GENERATION` | `WEAK_HOOK`, `TOO_AD_LIKE`, `AI_FLAVOR`, `PARAMETER_DUMP`, `POOR_TITLE`, `POOR_IMAGE_PROMPT`, `TAG_QUALITY` |
| `DOUYIN_GENERATION` | `WEAK_HOOK`, `POOR_SCENE_FLOW`, `VOICEOVER_UNNATURAL`, `CTA_TOO_HARD`, `UNFILMABLE_VISUAL` |
| `HALLUCINATION` | `FAKE_PRICE`, `FAKE_DISCOUNT`, `FAKE_FUNCTION`, `FAKE_SALES`, `FAKE_CERTIFICATION`, `FAKE_EFFICACY`, `FAKE_INVENTORY`, `FAKE_PROMOTION`, `FAKE_NEWS_FACT` |
| `INTERNAL_DATA_LEAK` | `SKU_LEAK`, `COST_LEAK`, `MARGIN_LEAK`, `SALES_LEAK`, `RETURN_RATE_LEAK`, `STOCK_LEAK`, `REVENUE_LEAK`, `SOURCE_FIELD_LEAK` |
| `NEWS_SOURCE` | `SOURCE_UNAVAILABLE`, `DUPLICATE_NEWS`, `STALE_NEWS`, `SOURCE_QUALITY`, `FIXTURE_NOT_REPRODUCIBLE` |
| `ENGINEERING_ERROR` | `INVALID_SCHEMA`, `MISSING_STAGE`, `UNHANDLED_EXCEPTION`, `MODEL_SERVICE_ERROR`, `TIMEOUT`, `PARSER_ERROR`, `PLATFORM_STATUS_MISMATCH`, `JUDGE_FAILURE` |
| `LATENCY` | `ANALYSIS_SLOW`, `MATCHING_SLOW`, `STRATEGY_SLOW`, `PLATFORM_SLOW`, `END_TO_END_SLOW` |

## Severity

- **S0**: unsafe commercial content, sensitive exploitation, severe fabricated health/safety claims, or serious internal data disclosure. Blocks release.
- **S1**: core pipeline decision failure, such as generating on a weak case, missing an unsafe event, forced association, or severe factual fabrication.
- **S2**: clearly poor strategy, platform mismatch, or unusable content without safety impact.
- **S3**: minor title, wording, verbosity, or tag quality issue.

## Priority mapping

Group badcases by repeated module/subtype and shared root cause before creating a requirement. Score candidate work as `frequency × severityWeight × userImpact`, with severity weights S0=8, S1=5, S2=3, S3=1 and user impact 1–3. Any S0 is P0; repeated/high-impact S1 is P1; platform-level S2 is P2; isolated S3 is P3. This score orders work within a tier; it never downgrades an S0.
