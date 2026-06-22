/**
 * lib/marketData.ts
 * ------------------
 * Free, no-API-key market data via Yahoo Finance's unofficial endpoints.
 *
 * NOTE: These are unofficial endpoints — they can change or rate-limit
 * without notice. Fine for a portfolio/demo project; not for production
 * trading. If they break, swap in a free-tier provider like Finnhub or
 * Alpha Vantage (both have generous free tiers with an API key).
 */

const YF_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_OPTIONS_URL = "https://query1.finance.yahoo.com/v7/finance/options";

export interface Quote {
  ticker: string;
  price: number;
  previousClose: number;
  changePercent: number;
  currency: string;
  marketTime: number; // unix timestamp
}

/**
 * Get the latest price for a ticker.
 */
export async function getQuote(ticker: string): Promise<Quote> {
  const url = `${YF_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    // Yahoo data is fine to cache briefly to avoid hammering the endpoint
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch quote for ${ticker}: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data returned for ${ticker}`);
  }

  const meta = result.meta;
  return {
    ticker: ticker.toUpperCase(),
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose ?? meta.chartPreviousClose,
    changePercent:
      ((meta.regularMarketPrice - (meta.previousClose ?? meta.chartPreviousClose)) /
        (meta.previousClose ?? meta.chartPreviousClose)) *
      100,
    currency: meta.currency,
    marketTime: meta.regularMarketTime,
  };
}

/**
 * Get historical daily closes for a date range — used for portfolio
 * normalization charts (e.g. "vs Pelosi's portfolio").
 *
 * `range` examples: "1mo", "3mo", "6mo", "1y", "2y"
 */
export async function getHistory(
  ticker: string,
  range: string = "6mo"
): Promise<{ date: string; close: number }[]> {
  const url = `${YF_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch history for ${ticker}: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No history returned for ${ticker}`);
  }

  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      close: closes[i],
    }))
    .filter((row) => row.close != null);
}

export interface OptionContract {
  contractSymbol: string;
  strike: number;
  bid: number;
  ask: number;
  lastPrice: number;
  impliedVolatility: number;
  volume: number;
  openInterest: number;
  inTheMoney: boolean;
}

export interface OptionsChain {
  underlyingPrice: number;
  expirationDates: number[]; // unix timestamps
  calls: OptionContract[];
  puts: OptionContract[];
}

/**
 * Get the options chain for a ticker. If `expiration` (unix timestamp)
 * is omitted, Yahoo returns the nearest expiration.
 */
export async function getOptionsChain(
  ticker: string,
  expiration?: number
): Promise<OptionsChain> {
  let url = `${YF_OPTIONS_URL}/${encodeURIComponent(ticker)}`;
  if (expiration) url += `?date=${expiration}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch options for ${ticker}: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.optionChain?.result?.[0];
  if (!result) {
    throw new Error(`No options data returned for ${ticker}`);
  }

  const opt = result.options?.[0] ?? { calls: [], puts: [] };

  return {
    underlyingPrice: result.quote?.regularMarketPrice,
    expirationDates: result.expirationDates ?? [],
    calls: opt.calls ?? [],
    puts: opt.puts ?? [],
  };
}

/**
 * 30-day realized volatility (annualized) — used as an IV proxy / context
 * for AI commentary, mirroring the approach in soxl-vol-surface/src/iv_rank.py
 */
export async function getRealizedVol(ticker: string): Promise<number | null> {
  const history = await getHistory(ticker, "3mo");
  if (history.length < 31) return null;

  const closes = history.map((h) => h.close);
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const last30 = logReturns.slice(-30);
  const mean = last30.reduce((a, b) => a + b, 0) / last30.length;
  const variance =
    last30.reduce((a, b) => a + (b - mean) ** 2, 0) / (last30.length - 1);
  const dailyStd = Math.sqrt(variance);

  return dailyStd * Math.sqrt(252); // annualized
}
