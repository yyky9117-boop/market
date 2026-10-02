import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";

export const REVIEW_FIELDS = [
  "是否真的是Badcase",
  "营销逻辑自然度",
  "商品植入自然度",
  "内容策略合理性",
  "事实可信度",
  "平台适配度",
  "安全性",
  "WouldUse",
  "一级归因",
  "二级归因",
  "Severity",
  "人工问题描述",
  "建议修复方向",
  "是否进入需求池",
  "备注",
] as const;

export type ReviewField = (typeof REVIEW_FIELDS)[number];
export type ReviewValue = string | number | null;
export type ReviewAnswers = Partial<Record<ReviewField, ReviewValue>>;

export interface SavedReview extends ReviewAnswers {
  updatedAt?: string;
}

export interface EvaluationCase {
  caseId: string;
  testType: string;
  newsTitle: string;
  newsSummary: string;
  matchedProduct: string;
  goldenExpected: string;
  actualResult: string;
  relationshipPath: string;
  contentStrategy: string;
  weibo: string;
  xiaohongshu: string;
  shortVideo: string;
  machineBadcaseType: string;
  machineJudgeReason: string;
  machinePriority: string;
  reviewStatus: "未评测" | "已评测" | "有争议";
  machineSuggestedPrimary: string;
  machineSuggestedSecondary: string;
  review: ReviewAnswers;
}

export interface ReviewProgress {
  [caseId: string]: SavedReview;
}

const evaluationDir = path.join(process.cwd(), "evaluation");
const workbookPath = path.join(evaluationDir, "human", "badcase_human_review.xlsx");
const progressPath = path.join(evaluationDir, "review-progress.json");
const mainSheetName = "Badcase人工复核";
const primaryAttributions = [
  "NEWS_UNDERSTANDING", "SAFETY_GATE", "SENSITIVE_TOPIC", "CONSUMER_NEED",
  "PRODUCT_MATCHING", "MARKETING_RELEVANCE", "CONTENT_STRATEGY", "WEIBO_GENERATION",
  "XHS_GENERATION", "DOUYIN_GENERATION", "HALLUCINATION", "INTERNAL_DATA_LEAK",
  "NEWS_SOURCE", "ENGINEERING_ERROR", "LATENCY", "GOLDEN_LABEL_ISSUE", "OTHER",
];

const moduleToAttribution: Record<string, string> = {
  FACTUALITY: "HALLUCINATION",
  CONTENT_POLICY: "SAFETY_GATE",
  ENGINEERING_ERROR: "ENGINEERING_ERROR",
  MARKETING_RELEVANCE: "MARKETING_RELEVANCE",
  PRODUCT_MATCHING: "PRODUCT_MATCHING",
  SENSITIVE_TOPIC: "SENSITIVE_TOPIC",
};

let workbookPromise: Promise<ExcelJS.Workbook> | undefined;
let progressWriteQueue: Promise<void> = Promise.resolve();

function cellText(cell: ExcelJS.Cell): string {
  return cell.text?.trim() ?? "";
}

function normalizeArtifactWorkbookXml(input: Buffer): Promise<Buffer> {
  return JSZip.loadAsync(input).then(async (zip) => {
    const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const names = Object.keys(zip.files).filter((name) => name.endsWith(".xml"));
    await Promise.all(names.map(async (name) => {
      const file = zip.file(name);
      if (!file) return;
      let xml = await file.async("string");
      if (xml.includes("x:")) xml = xml.replace(/(<\/?)(?:x):/g, "$1").replace(/\sxmlns:x="[^"]+"/g, "");
      if (name.startsWith("xl/worksheets/sheet")) {
        xml = xml.replace(/<tableParts[\s\S]*?<\/tableParts>/g, "").replace(/<tableParts[^>]*\/>/g, "");
      }
      if (name.includes("/_rels/sheet") && name.endsWith(".xml.rels")) {
        xml = xml.replace(/<Relationship[^>]*Type="[^"]*table[^"]*"[^>]*\/>/g, "");
      }
      if (name === "[Content_Types].xml") {
        xml = xml.replace(/<Override[^>]*PartName="\/xl\/tables\/[^"]+"[^>]*\/>/g, "");
      }
      const roots: Record<string, string> = {
        "xl/workbook.xml": "workbook",
        "xl/styles.xml": "styleSheet",
        "xl/sharedStrings.xml": "sst",
        "xl/worksheets/sheet1.xml": "worksheet",
        "xl/worksheets/sheet2.xml": "worksheet",
        "xl/worksheets/sheet3.xml": "worksheet",
        "xl/tables/table1.xml": "table",
      };
      const rootName = roots[name];
      if (rootName) {
        xml = xml.replace(`<${rootName}`, `<${rootName} xmlns="${namespace}"`);
      }
      zip.file(name, xml);
    }));
    for (const name of Object.keys(zip.files)) if (name.startsWith("xl/tables/")) zip.remove(name);
    return zip.generateAsync({ type: "nodebuffer" });
  });
}

async function loadSourceWorkbook(): Promise<ExcelJS.Workbook> {
  if (!workbookPromise) {
    workbookPromise = (async () => {
      const input = await fs.readFile(workbookPath);
      const compatible = await normalizeArtifactWorkbookXml(input);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(compatible as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      return workbook;
    })().catch((error) => {
      workbookPromise = undefined;
      throw error;
    });
  }
  return workbookPromise;
}

async function readProgress(): Promise<ReviewProgress> {
  try {
    const text = await fs.readFile(progressPath, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("review-progress.json must be an object keyed by Case ID");
    }
    return parsed as ReviewProgress;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function splitMachineSuggestions(type: string): { primary: string; secondary: string } {
  const tagLine = type.split(/\r?\n/).find((line) => /^[A-Z_]+\/[A-Z0-9_]+$/.test(line.trim()));
  if (!tagLine) return { primary: "", secondary: "" };
  const [module, subtype] = tagLine.trim().split("/");
  return { primary: moduleToAttribution[module] ?? (primaryAttributions.includes(module) ? module : ""), secondary: subtype };
}

function isComplete(review: ReviewAnswers): boolean {
  return review["是否真的是Badcase"] === "是" || review["是否真的是Badcase"] === "否";
}

function normalizedReview(progress: ReviewProgress, caseId: string): ReviewAnswers {
  const saved = progress[caseId] ?? {};
  return Object.fromEntries(REVIEW_FIELDS.map((field) => [field, saved[field] ?? null])) as ReviewAnswers;
}

export async function getEvaluationCases(): Promise<EvaluationCase[]> {
  const workbook = await loadSourceWorkbook();
  const sheet = workbook.getWorksheet(mainSheetName);
  if (!sheet) throw new Error(`Workbook sheet not found: ${mainSheetName}`);
  sheet.autoFilter = { from: "A1", to: `AD${sheet.rowCount}` };
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => headers.set(cellText(cell), column));
  const requiredHeaders = ["Case ID", "测试类型", "新闻标题", "新闻摘要", "匹配商品", "Golden预期", "系统实际结果", "Relationship Path", "Content Strategy", "微博结果", "小红书结果", "短视频结果", "机器Badcase类型", "Machine / Judge 原因", "机器建议优先级", ...REVIEW_FIELDS];
  const missing = requiredHeaders.filter((header) => !headers.has(header));
  if (missing.length) throw new Error(`Workbook is missing expected headers: ${missing.join(", ")}`);
  const progress = await readProgress();
  const cases: EvaluationCase[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const get = (header: string) => cellText(row.getCell(headers.get(header)!));
    const caseId = get("Case ID");
    if (!caseId) continue;
    const saved = progress[caseId] ?? {};
    const review = normalizedReview(progress, caseId);
    const machineBadcaseType = get("机器Badcase类型");
    const suggestions = splitMachineSuggestions(machineBadcaseType);
    const disputed = review["是否真的是Badcase"] === "有争议";
    const complete = isComplete(review);
    cases.push({
      caseId,
      testType: get("测试类型"),
      newsTitle: get("新闻标题"),
      newsSummary: get("新闻摘要"),
      matchedProduct: get("匹配商品"),
      goldenExpected: get("Golden预期"),
      actualResult: get("系统实际结果"),
      relationshipPath: get("Relationship Path"),
      contentStrategy: get("Content Strategy"),
      weibo: get("微博结果"),
      xiaohongshu: get("小红书结果"),
      shortVideo: get("短视频结果"),
      machineBadcaseType,
      machineJudgeReason: get("Machine / Judge 原因"),
      machinePriority: get("机器建议优先级"),
      reviewStatus: disputed ? "有争议" : complete ? "已评测" : "未评测",
      machineSuggestedPrimary: suggestions.primary,
      machineSuggestedSecondary: suggestions.secondary,
      review: { ...review, updatedAt: saved.updatedAt ?? null } as ReviewAnswers,
    });
  }
  return cases;
}

export async function getReviewProgress(): Promise<ReviewProgress> {
  return readProgress();
}

export async function saveReview(caseId: string, incoming: unknown): Promise<SavedReview> {
  const cases = await getEvaluationCases();
  if (!cases.some((item) => item.caseId === caseId)) throw new Error(`Unknown Case ID: ${caseId}`);
  if (typeof incoming !== "object" || incoming === null || Array.isArray(incoming)) {
    throw new Error("Review fields must be an object");
  }
  const record = incoming as Record<string, unknown>;
  const clean: ReviewAnswers = {};
  const scores = new Set<ReviewField>(["营销逻辑自然度", "商品植入自然度", "内容策略合理性", "事实可信度", "平台适配度", "安全性"]);
  for (const field of REVIEW_FIELDS) {
    if (!(field in record)) continue;
    const value = record[field];
    if (value === null || value === "") { clean[field] = null; continue; }
    if (scores.has(field)) {
      const score = Number(value);
      if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error(`${field} must be between 1 and 5`);
      clean[field] = score;
    } else if (typeof value === "string") {
      clean[field] = value.slice(0, field === "备注" || field === "人工问题描述" || field === "建议修复方向" ? 5000 : 160);
    } else throw new Error(`${field} must be text`);
  }
  validateReviewAnswers(clean);

  const operation = async () => {
    const progress = await readProgress();
    const saved: SavedReview = {
      ...progress[caseId],
      ...clean,
      updatedAt: new Date().toISOString(),
    };
    const updated = { ...progress, [caseId]: saved };
    const temporaryPath = `${progressPath}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, progressPath);
    return saved;
  };
  const result = progressWriteQueue.then(operation, operation);
  progressWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

function validateReviewAnswers(answer: ReviewAnswers): void {
  const allowed: Partial<Record<ReviewField, string[]>> = {
    "是否真的是Badcase": ["是", "否", "有争议"],
    WouldUse: ["直接使用", "修改后使用", "不会使用"],
    "一级归因": [...primaryAttributions],
    Severity: ["S0", "S1", "S2", "S3"],
    "是否进入需求池": ["是", "否", "待讨论"],
  };
  for (const [field, values] of Object.entries(allowed) as [ReviewField, string[]][]) {
    const value = answer[field];
    if (value != null && value !== "" && !values.includes(String(value))) throw new Error(`Invalid ${field}`);
  }
}

export async function getEvaluationSummary() {
  const cases = await getEvaluationCases();
  const reviews = cases.map((item) => item.review);
  const complete = cases.filter((item) => item.reviewStatus === "已评测");
  const confirmed = reviews.filter((review) => review["是否真的是Badcase"] === "是").length;
  const falseReports = reviews.filter((review) => review["是否真的是Badcase"] === "否").length;
  const ratingFields = ["营销逻辑自然度", "商品植入自然度", "内容策略合理性", "事实可信度", "平台适配度", "安全性"] as const;
  const averages = Object.fromEntries(ratingFields.map((field) => {
    const values = complete.flatMap((item) => {
      const raw = item.review[field];
      if (raw == null || raw === "") return [];
      const value = Number(raw);
      return Number.isInteger(value) && value >= 1 && value <= 5 ? [value] : [];
    });
    return [field, values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null];
  }));
  const wouldUse = Object.fromEntries(["直接使用", "修改后使用", "不会使用"].map((label) => [label, reviews.filter((review) => review.WouldUse === label).length]));
  const attributionCounts = new Map<string, number>();
  for (const review of reviews.filter((item) => item["是否真的是Badcase"] === "是")) {
    const value = review["一级归因"];
    if (typeof value === "string" && value) attributionCounts.set(value, (attributionCounts.get(value) ?? 0) + 1);
  }
  const attributionTop5 = [...attributionCounts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
  return {
    total: cases.length,
    completed: complete.length,
    disputed: cases.filter((item) => item.reviewStatus === "有争议").length,
    completionRate: cases.length ? complete.length / cases.length : 0,
    confirmedBadcases: confirmed,
    machineFalseReports: falseReports,
    averages,
    wouldUse,
    attributionTop5,
  };
}

export async function exportCompletedWorkbook(): Promise<Buffer> {
  const input = await fs.readFile(workbookPath);
  const compatible = await normalizeArtifactWorkbookXml(input);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(compatible as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet(mainSheetName);
  if (!sheet) throw new Error(`Workbook sheet not found: ${mainSheetName}`);
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => headers.set(cellText(cell), column));
  const idColumn = headers.get("Case ID");
  if (!idColumn) throw new Error("Workbook is missing Case ID header");
  const progress = await readProgress();
  const rowById = new Map<string, ExcelJS.Row>();
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const caseId = cellText(row.getCell(idColumn));
    if (caseId) rowById.set(caseId, row);
  }
  for (const [caseId, review] of Object.entries(progress)) {
    const row = rowById.get(caseId);
    if (!row) throw new Error(`Saved progress references unknown Case ID: ${caseId}`);
    for (const field of REVIEW_FIELDS) {
      const column = headers.get(field);
      if (!column) throw new Error(`Workbook is missing review column: ${field}`);
      row.getCell(column).value = review[field] ?? null;
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const evaluationWorkbookPath = workbookPath;
