import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Product } from "@/lib/types";

type ProductField = keyof Omit<Product, "sourceFields">;

const aliases: Record<ProductField, string[]> = {
  sku: ["SKU", "商品SKU", "SKU编码"],
  category: ["一级品类", "一级分类", "商品一级品类"],
  subcategory: ["二级品类", "二级分类", "商品二级品类"],
  name: ["商品名", "商品名称", "产品名称"],
  price: ["售价", "销售价", "价格"],
  cost: ["成本价", "商品成本"],
  margin: ["毛利率", "毛利"],
  monthlySales: ["月销量", "月销售量"],
  monthlyRevenue: ["月销售额", "月销售金额"],
  returnRate: ["退货率", "退货比例"],
  stock: ["库存量", "库存", "当前库存"],
  rating: ["用户评分", "商品评分", "评分"],
  detail: ["商品详情", "商品描述", "商品卖点", "详情"],
};

const requiredFields: ProductField[] = [
  "sku", "category", "subcategory", "name", "price", "cost", "margin",
  "monthlySales", "monthlyRevenue", "returnRate", "stock", "rating", "detail",
];

const numericFields = new Set<ProductField>([
  "price", "cost", "margin", "monthlySales", "monthlyRevenue", "returnRate", "stock", "rating",
]);

function normalizeHeader(value: string): string {
  return value.trim().replace(/[\s_·-]/g, "").toLowerCase();
}

function toJsonValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("result" in value) return toJsonValue(value.result as ExcelJS.CellValue);
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberValue(value: unknown, field: string, rowNumber: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/[￥¥,，%％\s]/g, ""));
  if (Number.isFinite(parsed)) {
    // Percentage cells may be stored as display text like "38.3%".
    return /[%％]/.test(String(value)) ? parsed / 100 : parsed;
  }
  throw new Error(`第 ${rowNumber} 行的「${field}」不是有效数字：${String(value)}`);
}

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const input = process.argv[2];
  if (!input || input.startsWith("--")) {
    throw new Error("用法：pnpm products:convert <商品详情数据.xlsx> [--sheet Sheet1] [--output data/products.json]");
  }

  const inputPath = path.resolve(input);
  const outputPath = path.resolve(getOption("--output") ?? "data/products.json");
  const requestedSheet = getOption("--sheet");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  const worksheets = requestedSheet
    ? [workbook.getWorksheet(requestedSheet)].filter((sheet): sheet is ExcelJS.Worksheet => Boolean(sheet))
    : workbook.worksheets;
  if (requestedSheet && worksheets.length === 0) {
    throw new Error(`找不到工作表「${requestedSheet}」。可用工作表：${workbook.worksheets.map((sheet) => sheet.name).join("、")}`);
  }

  let headerRow: ExcelJS.Row | undefined;
  let worksheet: ExcelJS.Worksheet | undefined;
  for (const candidate of worksheets) {
    const firstPopulatedRow = candidate.getRows(1, candidate.rowCount)?.find((row) =>
      row.values.some((value) => value !== null && value !== undefined && String(value).trim() !== ""),
    );
    if (firstPopulatedRow) {
      worksheet = candidate;
      headerRow = firstPopulatedRow;
      break;
    }
  }
  if (!worksheet || !headerRow) throw new Error("工作簿中没有可读取的商品数据行。");

  const headers = headerRow.values
    .slice(1)
    .map((value) => textValue(toJsonValue(value as ExcelJS.CellValue)));
  const normalizedHeaders = headers.map(normalizeHeader);
  const columnByField = new Map<ProductField, number>();

  for (const field of requiredFields) {
    const accepted = aliases[field].map(normalizeHeader);
    const column = normalizedHeaders.findIndex((header) => accepted.includes(header));
    if (column < 0) throw new Error(`工作表「${worksheet.name}」缺少「${aliases[field][0]}」列。现有列：${headers.filter(Boolean).join("、")}`);
    columnByField.set(field, column + 1);
  }

  const products: Product[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow!.number) return;
    const sourceFields = headers.map((header, index) => ({
      column: index + 1,
      header,
      value: toJsonValue(row.getCell(index + 1).value),
    }));
    if (sourceFields.every((field) => field.value === null || textValue(field.value) === "")) return;

    const sourceValue = (field: ProductField) => toJsonValue(row.getCell(columnByField.get(field)!).value);
    const normalizedValues: Record<string, unknown> = {};
    for (const field of requiredFields) {
      const value = sourceValue(field);
      if (numericFields.has(field)) {
        normalizedValues[field] = numberValue(value, aliases[field][0], rowNumber);
      } else {
        normalizedValues[field] = textValue(value);
      }
    }
    products.push({ ...normalizedValues, sourceFields } as Product);
  });

  if (products.length === 0) throw new Error(`工作表「${worksheet.name}」中没有商品记录。`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(products, null, 2)}\n`, "utf8");
  console.log(`已从「${worksheet.name}」转换 ${products.length} 条商品记录：${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
