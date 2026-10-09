import type {
  ContentStrategy,
  MarketingOpportunityEvaluation,
  NewsAnalysis,
  NewsItem,
  PlatformContentByKey,
  PlatformKey,
} from "@/lib/types";
import {
  contentStrategyPrompt,
  douyinPrompt,
  marketingOpportunityPrompt,
  newsAnalysisPrompt,
  type PlatformContentContext,
  weiboPrompt,
  xiaohongshuPrompt,
} from "@/lib/prompts";
import { groundingIssues, usesSensitiveMarketingHook } from "@/lib/contentGrounding";
import { ModelServiceError, modelDeadline, requestModelJson } from "@/lib/llmTransport";

async function callValidatedLLM<T>(prompt: string, code: string, validate: (result: unknown) => T): Promise<T> {
  const deadline = modelDeadline();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await requestModelJson(prompt, deadline);
    try { return validate(result); }
    catch (error) {
      const message = error instanceof Error ? error.message : "模型字段不符合要求。";
      if (attempt === 1) throw new ModelServiceError(code, message, false, attempt + 1);
      // Ask for one corrected response, without sending provider bodies or inventing defaults.
      prompt += `\n# 输出校正\n上次输出未通过校验：${message} 请重新回答原任务，补齐全部字段并遵守事实来源，仅输出完整 JSON。`;
    }
  }
  throw new ModelServiceError(code, "模型字段校验失败。");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function analyzeNews(news: NewsItem): Promise<NewsAnalysis> {
  return callValidatedLLM(newsAnalysisPrompt(news), "NEWS_ANALYSIS_ERROR", result => {
    if (!isRecord(result)) throw new Error("新闻分析结果格式不正确。");
    const { marketingSafe, riskLevel, riskReason, consumerNeed, productKeyword, reason } = result;
    if (typeof marketingSafe !== "boolean" || !["low", "medium", "high"].includes(String(riskLevel))) {
      throw new Error("新闻分析结果缺少有效的安全判断。");
    }
    const keywords = typeof productKeyword === "string"
      ? (productKeyword.trim() ? [productKeyword.trim()] : [])
      : Array.isArray(productKeyword) && productKeyword.every((value) => typeof value === "string")
        ? productKeyword.map((value) => value.trim()).filter(Boolean)
        : null;
    const sensitiveText = `${news.title} ${news.brief}`;
    const inferredSensitive = /ADHD|抑郁|焦虑症|心理健康|精神健康|儿童发育|儿童心理|疾病|诊断|医疗/i.test(sensitiveText);
    if ([riskReason, consumerNeed, reason].some((value) => typeof value !== "string") || !keywords) {
      throw new Error("新闻分析结果字段不完整。");
    }
    if (typeof result.sensitiveTopic !== "boolean" && !inferredSensitive) {
      throw new Error("新闻分析结果缺少敏感话题判断。");
    }
    return {
      marketingSafe,
      riskLevel: riskLevel as NewsAnalysis["riskLevel"],
      riskReason: riskReason as string,
      sensitiveTopic: typeof result.sensitiveTopic === "boolean" ? result.sensitiveTopic : inferredSensitive,
      sensitiveType: typeof result.sensitiveType === "string" ? result.sensitiveType : inferredSensitive ? "sensitive_topic" : null,
      opportunity: typeof result.opportunity === "string" ? result.opportunity : "",
      scene: typeof result.scene === "string" ? result.scene : "",
      consumerNeed: consumerNeed as string,
      productKeyword: keywords,
      reason: reason as string,
    };
  });
}

export async function evaluateMarketingOpportunityModel(
  news: NewsItem,
  analysis: NewsAnalysis,
  product: Parameters<typeof marketingOpportunityPrompt>[2],
): Promise<MarketingOpportunityEvaluation> {
  return callValidatedLLM(marketingOpportunityPrompt(news, analysis, product), "OPPORTUNITY_EVALUATION_ERROR", result => {
    if (!isRecord(result) || typeof result.productFitScore !== "number" ||
      typeof result.fitLevel !== "string" || typeof result.shouldGenerate !== "boolean" ||
      typeof result.fitReason !== "string" || !Array.isArray(result.relationshipPath) ||
      !result.relationshipPath.every((step) => typeof step === "string") || !Number.isFinite(result.productFitScore) ||
      !["strong", "medium", "weak"].includes(result.fitLevel) ||
      !Array.isArray(result.newsEvidence) || !result.newsEvidence.every(step => typeof step === "string") ||
      typeof result.requiresInventedScene !== "boolean") {
      throw new Error("营销机会评估结果格式不正确。");
    }
    return {
      productFitScore: Math.max(0, Math.min(100, Math.round(result.productFitScore))),
      fitLevel: result.fitLevel as MarketingOpportunityEvaluation["fitLevel"],
      shouldGenerate: result.shouldGenerate,
      fitReason: result.fitReason.trim(),
      relationshipPath: result.relationshipPath.map((step) => step.trim()).filter(Boolean),
      newsEvidence: result.newsEvidence.map(step => step.trim()).filter(Boolean),
      requiresInventedScene: result.requiresInventedScene,
    };
  });
}

export async function planContentStrategy(
  news: NewsItem,
  analysis: NewsAnalysis,
  product: Parameters<typeof contentStrategyPrompt>[2],
  opportunity: MarketingOpportunityEvaluation,
): Promise<ContentStrategy> {
  return callValidatedLLM(contentStrategyPrompt(news, analysis, product, opportunity), "CONTENT_STRATEGY_ERROR", result => {
    const fields: Array<keyof ContentStrategy> = [
      "audience", "scene", "consumerPainPoint", "productRole", "contentAngle", "coreMessage", "toneHint",
    ];
    if (!isRecord(result) || fields.some((field) => typeof result[field] !== "string" || !(result[field] as string).trim())) {
      throw new Error("内容策略规划结果格式不正确。");
    }
    const strategy = Object.fromEntries(fields.map((field) => [field, (result[field] as string).trim()])) as unknown as ContentStrategy;
    const issues = groundingIssues(Object.values(strategy).join(" "), news, product);
    if (issues.length) throw new Error(issues.join("；"));
    return strategy;
  });
}

export async function generatePlatformContent<K extends PlatformKey>(
  platform: K,
  context: PlatformContentContext,
): Promise<PlatformContentByKey[K]> {
  const prompt = platform === "weibo"
    ? weiboPrompt(context)
    : platform === "xiaohongshu"
      ? xiaohongshuPrompt(context)
      : douyinPrompt(context);
  return callValidatedLLM(prompt, "PLATFORM_GENERATION_ERROR", result => {
    if (!isRecord(result)) throw new Error(`${platform} 内容格式不正确。`);
    const issues = groundingIssues(JSON.stringify(result), context.news, context.product);
    if (issues.length) throw new Error(issues.join("；"));
    if (context.analysis.sensitiveTopic && usesSensitiveMarketingHook(JSON.stringify(result))) {
      throw new Error("消费者内容使用了健康、诊断或儿童健康议题作为营销入口，请改为独立的中性生活场景。");
    }

    if (platform === "weibo") {
      const { title, content, hashtags } = result;
      if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim() ||
        !Array.isArray(hashtags) || hashtags.length < 2 || hashtags.length > 4 ||
        !hashtags.every((tag) => typeof tag === "string" && tag.trim())) {
        throw new Error("微博内容缺少有效字段。");
      }
      return { title: title.trim(), content: content.trim(), hashtags: (hashtags as string[]).map((tag) => tag.trim()) } as PlatformContentByKey[K];
    }

    if (platform === "xiaohongshu") {
      const { contentAngle, title, hook, content, tags, coverText, imagePrompt } = result;
      if (typeof contentAngle !== "string" || !contentAngle.trim() ||
        typeof title !== "string" || !title.trim() || typeof hook !== "string" || !hook.trim() || hook.trim().length > 120 ||
        typeof content !== "string" || !content.trim() ||
        !Array.isArray(tags) || tags.length < 3 || tags.length > 6 ||
        !tags.every((tag) => typeof tag === "string" && tag.trim()) ||
        typeof coverText !== "string" || !coverText.trim() || typeof imagePrompt !== "string" || !imagePrompt.trim()) {
        throw new Error("小红书内容缺少有效字段。");
      }
      return {
        contentAngle: contentAngle.trim(),
        title: title.trim(),
        hook: hook.trim(),
        content: content.trim(),
        tags: (tags as string[]).map((tag) => tag.trim()),
        coverText: coverText.trim(),
        imagePrompt: imagePrompt.trim(),
      } as PlatformContentByKey[K];
    }

    const { title, hook, scenes, cta } = result;
    if (typeof title !== "string" || !title.trim() || typeof hook !== "string" || !hook.trim() ||
      typeof cta !== "string" || !cta.trim() || !Array.isArray(scenes) || scenes.length < 3 || scenes.length > 5 ||
      !scenes.every((scene, index) => isRecord(scene) && scene.shot === index + 1 &&
        typeof scene.visual === "string" && scene.visual.trim() &&
        typeof scene.voiceover === "string" && scene.voiceover.trim())) {
      throw new Error("短视频脚本缺少有效字段。");
    }
    return {
      title: title.trim(),
      hook: hook.trim(),
      scenes: scenes.map((scene) => ({
        shot: scene.shot as number,
        visual: (scene as Record<string, unknown>).visual as string,
        voiceover: (scene as Record<string, unknown>).voiceover as string,
      })),
      cta: cta.trim(),
    } as PlatformContentByKey[K];
  });
}
