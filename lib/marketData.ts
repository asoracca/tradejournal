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
  source?: "synthetic" | "live";
  stale?: boolean;
  unavailableReason?: string;
  marketTime: number; // unix timestamp
}

/**
 * Get the latest price for a ticker.
 */
async function liveQuote(ticker: string): Promise<Quote> {
  const url = `${YF_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(4000),
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
  if (process.env.MARKET_DATA_MODE !== "live") return Array.from({length:30}, (_,i) => ({date: new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),close:100+i/3}));
  const url = `${YF_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(4000),
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
  if (process.env.MARKET_DATA_MODE !== "live") return {underlyingPrice:110,expirationDates:[],calls:[],puts:[]};
  let url = `${YF_OPTIONS_URL}/${encodeURIComponent(ticker)}`;
  if (expiration) url += `?date=${expiration}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(4000),
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

// Synthetic inputs are deliberately fixed, unrelated to real security prices.
export function syntheticQuote(ticker: string): Quote {
  return {ticker:ticker.toUpperCase(),price:110,previousClose:108,changePercent:100*(110-108)/108,currency:"USD",marketTime:1769817600,source:"synthetic",stale:false};
}
export function quoteAdapter(provider: (ticker:string)=>Promise<Quote>, now=Date.now, timeoutMs=4500) {
  const cache = new Map<string,{quote:Quote; fetched:number}>();
  return async (ticker:string):Promise<Quote> => {
    const key=ticker.toUpperCase(); const previous=cache.get(key);
    if (previous && now()-previous.fetched < 30000) return previous.quote;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const quote=await Promise.race([provider(key),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("Market data timed out")),timeoutMs);})]);
      if (!Number.isFinite(quote.price) || quote.price <= 0 || !Number.isFinite(quote.marketTime)) throw Error("Invalid market data");
      const result={...quote,source:"live" as const,stale:now()-quote.marketTime*1000>15*60*1000};
      if(cache.size>=500) cache.delete(cache.keys().next().value!);
      cache.set(key,{quote:result,fetched:now()}); return result;
    } catch {
      if(previous) return {...previous.quote,stale:true,unavailableReason:"Provider unavailable; last cached quote shown."};
      throw Error("Market data unavailable; no cached quote.");
    } finally {clearTimeout(timer);}
  };
}
const cachedLiveQuote=quoteAdapter(liveQuote);
export async function getQuote(ticker:string) { return process.env.MARKET_DATA_MODE === "live" ? cachedLiveQuote(ticker) : syntheticQuote(ticker); }
