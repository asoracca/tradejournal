import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getQuote } from "./marketData";
export function aggregateQuery(
  userId: string,
  mode: string,
  account: string | null,
  marks: string,
) {
  return Prisma.sql`WITH marks AS (SELECT key AS ticker, value::numeric AS price FROM jsonb_each_text(${marks}::jsonb))
 SELECT COALESCE(sum(round((t."exitPrice"-t."entryPrice")*t.quantity*(CASE WHEN t.side='SELL' THEN -1 ELSE 1 END)*(CASE WHEN t.type='OPTION' THEN 100 ELSE 1 END),2)) FILTER (WHERE t.status='CLOSED'),0)::text AS realized,
 COALESCE(sum(round((m.price-t."entryPrice")*t.quantity*(CASE WHEN t.side='SELL' THEN -1 ELSE 1 END),2)) FILTER (WHERE t.status='OPEN' AND t.type='STOCK'),0)::text AS unrealized,
 count(*) FILTER (WHERE t.status='OPEN' AND (m.price IS NULL OR t.type<>'STOCK'))::int AS unpriced
 FROM "Trade" t LEFT JOIN marks m ON m.ticker=t.ticker
 WHERE t."userId"=${userId} AND t.mode=${mode} AND (${account}::text IS NULL OR t.account=${account})`;
}
export async function ledger(
  userId: string,
  mode = "PAPER",
  account: string | null = null,
) {
  const trades = await prisma.trade.findMany({
    where: { userId, mode, status: "OPEN", ...(account ? { account } : {}) },
    select: { ticker: true, type: true },
  });
  const quotes = await Promise.all(
    Array.from(
      new Set(trades.filter((t) => t.type === "STOCK").map((t) => t.ticker)),
    ).map(async (ticker) => {
      try {
        return await getQuote(ticker);
      } catch {
        return { ticker, price: null, stale: true, source: "unavailable" };
      }
    }),
  );
  const marks = Object.fromEntries(
    quotes
      .filter((q) => q.price !== null)
      .map((q) => [q.ticker, String(q.price)]),
  );
  const [totals] = await prisma.$queryRaw<
    { realized: string; unrealized: string; unpriced: number }[]
  >(aggregateQuery(userId, mode, account, JSON.stringify(marks)));
  return {
    ...totals,
    quotes,
    complete: totals.unpriced === 0,
    stale: quotes.some((q) => q.stale),
  };
}
