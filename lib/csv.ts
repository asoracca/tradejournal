import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { createTradeSchema, type TradeInput } from "./contracts";
import { ApiError } from "./http";
import { prisma } from "./db";
import { tradeData } from "./trades";
export function previewCsv(csv: string) {
  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 20000,
    });
  } catch {
    throw new ApiError(400, "CSV_FORMAT", "Invalid CSV structure.");
  }
  if (!records.length || records.length > 500)
    throw new ApiError(400, "CSV_SIZE", "Import 1–500 rows at a time.");
  return records.map((record, index) => {
    const input = Object.fromEntries(
      Object.entries(record).filter(([, v]) => v !== ""),
    );
    const result = createTradeSchema.safeParse(input);
    if (!result.success)
      return {
        row: index + 2,
        errors: result.error.issues.map(
          (i) => i.path.join(".") + ": " + i.message,
        ),
      };
    const data = result.data;
    const canonical = JSON.stringify(
      Object.fromEntries(
        Object.entries(data).sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
    return {
      row: index + 2,
      data,
      key: createHash("sha256").update(canonical).digest("hex"),
      errors: [] as string[],
    };
  });
}
export async function importCsv(userId: string, csv: string, commit: boolean) {
  const rows = previewCsv(csv);
  const valid = rows.filter(
    (
      r,
    ): r is { row: number; data: TradeInput; key: string; errors: string[] } =>
      !!r.data,
  );
  const existing = await prisma.trade.findMany({
    where: { userId, importKey: { in: valid.map((r) => r.key) } },
    select: { importKey: true },
  });
  const seen = new Set(existing.map((t) => t.importKey));
  const preview = rows.map((r) => {
    const duplicate = !!r.key && seen.has(r.key);
    if (r.key) seen.add(r.key);
    return { ...r, duplicate };
  });
  if (!commit) return { rows: preview, imported: 0 };
  if (rows.some((r) => r.errors.length))
    throw new ApiError(
      400,
      "CSV_VALIDATION",
      "Fix all preview errors before importing.",
    );
  // Database unique(userId,importKey) makes concurrent retries safe as well.
  const result = await prisma.trade.createMany({
    data: valid.map((r) => ({
      ...tradeData(r.data),
      userId,
      importKey: r.key,
    })),
    skipDuplicates: true,
  });
  return { rows: preview, imported: result.count };
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export async function exportCsv(userId: string, id?: string) {
  const rows = await prisma.trade.findMany({
    where: { userId, ...(id ? { id } : {}) },
    orderBy: { createdAt: "asc" },
    include: { aiComment: true },
  });
  if (id && !rows.length)
    throw new ApiError(404, "NOT_FOUND", "Record not found.");
  const keys = [
    "id",
    "ticker",
    "type",
    "side",
    "quantity",
    "entryPrice",
    "exitPrice",
    "status",
    "mode",
    "account",
    "notes",
  ] as const;
  return [
    keys.join(",") + ",aiComment",
    ...rows.map((t) =>
      [...keys.map((k) => csvCell(t[k])), csvCell(t.aiComment?.text)].join(","),
    ),
  ].join("\r\n");
}
