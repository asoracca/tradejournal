/**
 * lib/congress.ts
 * ----------------
 * Fetches and parses congressional stock trading disclosures from the
 * House Stock Watcher public dataset (free, no API key, updated daily).
 *
 * Source: https://housestockwatcher.com/  (data mirrored on S3 as JSON)
 *
 * NOTE: amounts are disclosed as RANGES (e.g. "$1,001 - $15,000") per the
 * STOCK Act. We use the midpoint for portfolio reconstruction — this is
 * a known approximation, document it in the UI/README.
 */

const HOUSE_STOCK_WATCHER_URL =
  "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json";

export interface RawCongressTransaction {
  disclosure_year: string;
  disclosure_date: string;
  transaction_date: string;
  owner: string;
  ticker: string;
  asset_description: string;
  type: string; // "purchase" | "sale_full" | "sale_partial" | "exchange"
  amount: string; // e.g. "$1,001 - $15,000"
  representative: string;
  district: string;
}

export interface ParsedCongressTrade {
  representative: string;
  ticker: string;
  transactionDate: string; // ISO date
  type: "purchase" | "sale" | "exchange";
  amountLow: number | null;
  amountHigh: number | null;
}

/**
 * Fetch the full House Stock Watcher dataset.
 * This is a large file (~tens of MB) — cache it (e.g. in your DB) rather
 * than fetching on every request. Suggest a daily cron/refresh script.
 */
export async function fetchHouseStockWatcherData(): Promise<RawCongressTransaction[]> {
  const res = await fetch(HOUSE_STOCK_WATCHER_URL, {
    next: { revalidate: 86400 }, // daily
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch House Stock Watcher data: ${res.status}`);
  }
  return res.json();
}

const AMOUNT_RANGE_REGEX = /\$?([\d,]+)\s*-\s*\$?([\d,]+)/;

function parseAmountRange(amount: string): { low: number | null; high: number | null } {
  const match = amount.match(AMOUNT_RANGE_REGEX);
  if (!match) return { low: null, high: null };
  return {
    low: parseFloat(match[1].replace(/,/g, "")),
    high: parseFloat(match[2].replace(/,/g, "")),
  };
}

function normalizeType(type: string): "purchase" | "sale" | "exchange" {
  if (type.toLowerCase().startsWith("purchase")) return "purchase";
  if (type.toLowerCase().startsWith("sale")) return "sale";
  return "exchange";
}

/**
 * Parse raw transactions into a cleaner shape, filtering out rows with
 * missing tickers (many disclosures are for non-equity assets like
 * municipal bonds, options written as text, etc. — skip those for the
 * portfolio reconstruction).
 */
export function parseTransactions(
  raw: RawCongressTransaction[]
): ParsedCongressTrade[] {
  return raw
    .filter((r) => r.ticker && r.ticker !== "--" && r.ticker.length <= 6)
    .map((r) => {
      const { low, high } = parseAmountRange(r.amount);
      return {
        representative: r.representative,
        ticker: r.ticker.toUpperCase(),
        transactionDate: r.transaction_date,
        type: normalizeType(r.type),
        amountLow: low,
        amountHigh: high,
      };
    });
}

/**
 * Get a sorted list of unique representative names — for the dropdown.
 */
export function getRepresentatives(trades: ParsedCongressTrade[]): string[] {
  return Array.from(new Set(trades.map((t) => t.representative))).sort();
}

/**
 * Reconstruct an approximate share-count portfolio for one representative
 * using FIFO logic and amount-range midpoints to estimate share counts.
 *
 * This is intentionally simple — see PLAN.md Phase 2 for the full
 * implementation prompt (needs historical prices at transaction date to
 * convert dollar amounts to share counts).
 */
export function getTradesForRepresentative(
  trades: ParsedCongressTrade[],
  representative: string
): ParsedCongressTrade[] {
  return trades
    .filter((t) => t.representative === representative)
    .sort(
      (a, b) =>
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );
}
