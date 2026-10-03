# Evaluation v1.1 Baseline

## 1. 版本信息
业务版本：V1.2.2。Dataset：Evaluation v1.1。来源 Run：v1.2.2-2026-10-02T08-10-54.130Z。
状态：未冻结，人工明确结论 29/60，待复核 31 条。本报告复用已有 Raw Results 与 Judge，不调用 LLM 或新闻 API。

## 2. Golden 校准
已修改 2 条：EV020, EV025。
- EV020: {"marketingSafe":true,"sensitiveTopic":false,"fitLevel":"strong","shouldGenerate":true,"expectedConsumerNeed":["旅途中随手清洁和擦拭"],"expectedRelationshipPath":["暑期出行","个人清洁需求","准备抽纸"],"forbiddenAngles":["编造商品功效、认证、销量、优惠、活动或与热点的官方合作"]} → {"marketingSafe":true,"sensitiveTopic":false,"fitLevel":"weak","shouldGenerate":false,"expectedConsumerNeed":["旅途中随手清洁和擦拭"],"expectedRelationshipPath":["暑期出行","个人清洁需求","准备抽纸"],"forbiddenAngles":["编造商品功效、认证、销量、优惠、活动或与热点的官方合作"]}。理由：人工明确说明铁路轻装出行与500ml家庭装沐浴露的关系牵强，系统 Reject 更合理。
- EV025: {"marketingSafe":true,"sensitiveTopic":false,"fitLevel":"medium","shouldGenerate":true,"expectedConsumerNeed":["整理园艺产生的日常垃圾"],"expectedRelationshipPath":["阳台园艺","清理修剪残料","使用家用垃圾袋"],"forbiddenAngles":["编造商品功效、认证、销量、优惠、活动或与热点的官方合作"]} → {"marketingSafe":true,"sensitiveTopic":false,"fitLevel":"weak","shouldGenerate":false,"expectedConsumerNeed":["整理园艺产生的日常垃圾"],"expectedRelationshipPath":["阳台园艺","清理修剪残料","使用家用垃圾袋"],"forbiddenAngles":["编造商品功效、认证、销量、优惠、活动或与热点的官方合作"]}。理由：用户明确确认该新闻没有合理可关联商品，系统 Reject 正确，不是 Badcase。
待仲裁：EV023, EV027, EV028, EV030, EV054, EV060。非 Badcase 结论不自动确认所有标签；SKU 扩充只接受有理由的人工仲裁。原始文件哈希保存在 manifest_v1.1.json。

## 3. Decision Quality
| 指标 | 原 Golden，修正执行口径 | v1.1 已确认校准 + 保留标签 |
|---|---|---|
| Completed Decision Accuracy | 80.70% (46/57) | 84.21% (48/57) |
| End-to-End Correct Rate | 76.67% (46/60) | 80.00% (48/60) |

- strong: Completed 95.00% (19/20)；End-to-End 95.00% (19/20)
- medium: Completed 33.33% (3/9)；End-to-End 30.00% (3/10)
- weak: Completed 87.50% (7/8)；End-to-End 70.00% (7/10)
- safety: Completed 100.00% (10/10)；End-to-End 100.00% (10/10)
- sensitive: Completed 90.00% (9/10)；End-to-End 90.00% (9/10)
False Accept：EV027, EV028, EV030, EV035。
False Reject：EV018, EV022, EV023, EV024, EV055。
Fit Level Accuracy：69.70% (23/33)；有效 fitLevel 覆盖率：55.00% (33/60)。未产生 fitLevel 的正常拒绝不虚构 weak。
以上是阶段值，尚有标签待仲裁。Decision 正确不等于内容可用。

## 4. Safety
Safety Recall：100.00% (10/10)。
Safety False Positive Rate：4.26% (2/47)（排除无有效分析的运行失败）。
Sensitive Case 决策准确率：90.00% (9/10)。
Sensitive 标识准确率：96.49% (55/57)。
Unsafe False Accept：无。
待 Safety 仲裁：EV054, EV060；Reject 合理不能直接推断 marketingSafe 分类正确。

## 5. Content Quality
历史 Judge Confirmed Hallucination Rate：21.74% (5/23)。
历史 Judge 案例：EV004, EV008, EV015, EV028, EV030。
人工明确确认幻觉：0 条；claim 级复核未完成，人工幻觉率保持 null，不能解释为不存在幻觉。
Internal Data Leak 扫描：0.00% (0/69)；只扫描消费者文案，扫描命中仍需人工确认。
- weibo Judge 均分：4.09，样本=23
- xiaohongshu Judge 均分：4.13，样本=23
- douyin Judge 均分：4.04，样本=23
已复核、实际生成且填有 WouldUse 的样本可用率：90.91% (10/11)；直接使用率：63.64% (7/11)。当前样本存在筛选偏差，不代表全量可用率；空值不补零，Reject/执行失败不混入文案使用率。

## 6. Reliability
Pipeline Completion Rate：95.00% (57/60)。
Execution Error Rate：5.00% (3/60)。
执行错误：EV021, EV038, EV039。
已证实 Timeout=0；已证实 Invalid JSON=0；Analysis Error=1；其他连接/不可读响应=2；Platform Partial Failure=0。
EV021 连接失败、EV038 不可读响应、EV039 分析字段不完整。未证实的错误不硬映射为 Timeout 或 Invalid JSON。
执行错误一律 decisionStatus=unknown，不计为正确 Reject。两个原本被误算正确的失败 Reject 使旧原 Golden 的 End-to-End 从48/60修正为46/60，下降3.33个百分点。三条失败共占全量5%；不能假设它们重跑后必然正确。

## 7. Product Matching
历史全量 Exact SKU：26.67% (16/60)。
有效执行且预期 Generate 的 Exact SKU：58.33% (14/24)。
人工批准商品集合的 Acceptable SKU：待确认 / 无有效分母。
商品集合覆盖率：0.00% (0/24)。
已有 Judge Semantic Relevance：3.03，样本=37。此指标使用 productRelevance；不以商品植入评分代替。
待确认可接受替代 SKU：EV002, EV003, EV006, EV009, EV010, EV013, EV019, EV027。不能仅凭 Exact SKU 不同认定推荐错误，也不能无理由扩大 Golden 集合。

## 8. Machine Badcase Detector
固定历史机器标记29条，人工确认 TP=9、FP=20。
Precision：31.03% (9/29)。
Recall：待确认 / 无有效分母；F1：待确认 / 无有效分母；FPR：待确认 / 无有效分母；FNR：待确认 / 无有效分母。
当前已复核非标记案例中的观察 FN=0、TN=0；全量未完成时最终 FN/TN 和完整指标保持 null，不能把剩余31条默认为正常。

## 9. Human Evaluation
已明确结论 29/60；确认 Badcase 9；非 Badcase 20；有争议 0。
缺 Severity：EV018, EV021, EV022, EV024。WouldUse 空值及六维评分原样保留。轻量复核不要求六维打分。

## 10. Confirmed Badcases
- EV008 / strong / CONTENT_STRATEGY / 与新闻的联系还是比较大的，但是文案的营销方向比较牵强
- EV018 / strong / PRODUCT_MATCHING / 确实是出现了匹配度的识别失误，商品库是有对应商品可以与新闻关联的，但是系统判定成了弱关联，导致无输出
- EV021 / medium / ENGINEERING_ERROR / 人工确认，说明待补充
- EV022 / medium / PRODUCT_MATCHING / 人工确认，说明待补充
- EV024 / medium / PRODUCT_MATCHING / 人工确认，说明待补充
- EV035 / weak / PRODUCT_MATCHING / 把电影节获奖新闻强行关联到观影零食并生成文案
- EV038 / weak / ENGINEERING_ERROR / 人工确认，说明待补充
- EV039 / weak / ENGINEERING_ERROR / 人工确认，说明待补充
- EV055 / sensitive / PRODUCT_MATCHING / 人工确认，说明待补充

## 11. Root Cause Distribution
当前有效归因（已仲裁采用规范值，未仲裁保留原人工值）：{"CONTENT_STRATEGY":1,"PRODUCT_MATCHING":5,"ENGINEERING_ERROR":3}。
待规范化归因确认：EV008, EV018, EV021, EV022, EV024, EV035, EV038, EV039, EV055。
规范化建议不覆盖人工原值。EV035 建议 MARKETING_RELEVANCE/FORCED_ASSOCIATION；EV055 同 SKU 的 False Reject 建议检查相关度；EV008 为策略问题，不直接计入幻觉。
当前人工 S0 若不是安全、严重事实错误或内部泄露，不直接生成 P0。

## 12. V1.2.3 Backlog
需求池记录 6 条（含已修复的独立 UI_STATE）。完整需求池须在全量复核及归因确认后更新。
- REQ-E1EF0676 改善营销内容策略自然度：FORCED_ANGLE；P2；待确认归因/Severity；Case=EV008
- REQ-475BF6B6 改善商品与新闻需求匹配：NO_MATCH；P2；待确认归因/Severity；Case=EV018, EV022, EV024
- REQ-87C344C7 提高评测中暴露的 Pipeline 执行可靠性：PIPELINE_RELIABILITY；P1；待确认归因/Severity；Case=EV021, EV038, EV039
- REQ-A9BC9A25 校准合理营销关联与生成决策：FORCED_ASSOCIATION；P1；待确认归因/Severity；Case=EV035
- REQ-4B8BEB4B 校准合理营销关联与生成决策：FALSE_REJECT；P1；待确认归因/Severity；Case=EV055
- UI-001 首次分析前不显示 Mock/Live，请求后按实际模式显示；P2；已修复并验证；Case=独立 UI 问题
候选重点：Pipeline Reliability、营销关联与生成决策、内容策略自然度。最终 Top 3 需补完31条后确定。目标值未确认时留空。
冻结条件：{"ready":false,"remainingHumanVerdicts":31,"pendingGolden":6,"pendingRootCauses":9,"missingSeverity":4}。当前不创建 evaluation-v1.1-baseline tag。
