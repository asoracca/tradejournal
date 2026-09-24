import { parse } from "csv-parse/sync";
import { ApiError } from "./http";
import { tradeApi } from "./trade-api";
export function parseCsv(csv: string): Record<string, string>[] {
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
  return records.map((record) =>
    Object.fromEntries(Object.entries(record).filter(([, v]) => v !== "")),
  );
}
export interface ImportResult {
  rows: {
    row: number;
    data?: Record<string, unknown>;
    errors: string[];
    duplicate: boolean;
  }[];
  imported: number;
}
export async function importCsv(userId: string, csv: string, commit: boolean) {
  return tradeApi<ImportResult>(
    userId,
    "/v1/imports/" + (commit ? "commit" : "preview"),
    "POST",
    parseCsv(csv),
  );
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export async function exportCsv(userId: string, id?: string) {
  type Row = Record<string, unknown> & { aiComment?: { text: string } };
  const rows = id
    ? [await tradeApi<Row>(userId, "/v1/trades/" + encodeURIComponent(id))]
    : await tradeApi<Row[]>(userId, "/v1/trades");
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
  ];
  return [
    keys.join(",") + ",aiComment",
    ...rows.map((t) =>
      [...keys.map((k) => csvCell(t[k])), csvCell(t.aiComment?.text)].join(","),
    ),
  ].join("\r\n");
}
