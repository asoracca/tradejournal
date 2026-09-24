import { getQuote } from "./marketData";
import { listTrades } from "./trades";
import { tradeApi } from "./trade-api";
export interface Portfolio {
  concentration: { ticker: string; notional: string; percent: string }[];
  realized: string;
  unrealized: string;
  equity: string;
  costBasis: string;
  marketValue: string;
  dayChange: string;
  dayPercent: string;
  winRate: string;
  unpriced: number;
  complete: boolean;
  dayComplete: boolean;
  positions: Record<
    string,
    {
      realized?: string;
      unrealized?: string | null;
      marketValue?: string | null;
      returnPercent?: string | null;
    }
  >;
}
export async function ledger(
  userId: string,
  mode = "PAPER",
  account: string | null = null,
  startBalance = "100000",
) {
  const trades = await listTrades(userId);
  const tickers = [
    ...new Set(
      trades
        .filter(
          (t) =>
            t.status === "OPEN" &&
            t.type === "STOCK" &&
            t.mode === mode &&
            (!account || t.account === account),
        )
        .map((t) => t.ticker),
    ),
  ];
  const quotes = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        return await getQuote(ticker);
      } catch {
        return {
          ticker,
          price: null,
          previousClose: null,
          stale: true,
          source: "unavailable",
        };
      }
    }),
  );
  const marks = Object.fromEntries(
    quotes
      .filter((q) => q.price !== null)
      .map((q) => [
        q.ticker,
        {
          price: String(q.price),
          previousClose:
            q.previousClose == null ? null : String(q.previousClose),
        },
      ]),
  );
  const totals = await tradeApi<Portfolio>(userId, "/v1/portfolio", "POST", {
    mode,
    account,
    startBalance,
    marks,
  });
  return { ...totals, quotes, stale: quotes.some((q) => q.stale) };
}
