import { createHash, createHmac, randomUUID } from "node:crypto";
import { ApiError } from "./http";
/** Server-only transport: browser headers never determine the internal identity. */
export async function tradeApi<T>(
  userId: string,
  path: string,
  method = "GET",
  input?: unknown,
): Promise<T> {
  const secret = process.env.TRADE_SERVICE_SECRET;
  const base = process.env.TRADE_API_URL || "http://127.0.0.1:8080";
  if (!secret || secret.length < 32)
    throw new ApiError(
      503,
      "TRADE_SERVICE_UNAVAILABLE",
      "Trade service is not configured.",
    );
  const body = input === undefined ? "" : JSON.stringify(input);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const digest = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update([method, path, userId, timestamp, nonce, digest].join("\n"))
    .digest("hex");
  let response: Response;
  try {
    response = await fetch(base + path, {
      method,
      body: body || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        "X-Trade-User": userId,
        "X-Trade-Time": timestamp,
        "X-Trade-Nonce": nonce,
        "X-Trade-Signature": signature,
      },
    });
  } catch {
    throw new ApiError(
      503,
      "TRADE_SERVICE_UNAVAILABLE",
      "Trade service unavailable. Please retry.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.code || "TRADE_SERVICE_ERROR",
      data?.error || "Trade request failed.",
    );
  if (data === null && response.status !== 200)
    throw new ApiError(
      502,
      "TRADE_SERVICE_ERROR",
      "Invalid trade service response.",
    );
  return data as T;
}
export interface TradeRecord {
  id: string;
  userId: string;
  ticker: string;
  type: "STOCK" | "OPTION";
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  target: number | null;
  strike: number | null;
  status: "OPEN" | "CLOSED";
  mode: "PAPER" | "REAL";
  account: string;
  createdAt: string;
  closedAt: string | null;
  tradeDate: string | null;
  optionType: "CALL" | "PUT" | null;
  expiration: string | null;
  notes: string | null;
  strategy: string | null;
  emotion: string | null;
  rulesFollowed: boolean;
  costBasis: string;
  realizedPnl: string;
  returnPercent: string;
  aiComment: { id: string; userId: string; text: string } | null;
  decimals: Record<string, string | null>;
}
/** Existing UI number fields are display-only. Exact values survive in decimals for editing. */
export function forDisplay(raw: Record<string, unknown>): TradeRecord {
  const result = { ...raw, decimals: {} as Record<string, string | null> };
  for (const key of [
    "quantity",
    "entryPrice",
    "exitPrice",
    "stopLoss",
    "target",
    "strike",
  ]) {
    const v = raw[key];
    result.decimals[key] = v == null ? null : String(v);
    (result as Record<string, unknown>)[key] = v == null ? null : Number(v);
  }
  return result as unknown as TradeRecord;
}
