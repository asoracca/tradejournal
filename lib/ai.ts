/**
 * lib/ai.ts — AI trade commentary via Google Gemini (free tier).
 * Set GEMINI_API_KEY in Vercel env vars. Free key at https://aistudio.google.com.
 * The AI gives neutral analytical context, never buy/sell advice.
 */

import { getQuote, getRealizedVol, getHistory } from "./marketData";

export interface TradeContext {
  ticker: string;
  type: "STOCK" | "OPTION" | "FUTURE";
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  optionType?: "CALL" | "PUT" | null;
  strike?: number | null;
}

async function buildContext(trade: TradeContext): Promise<string> {
  const parts: string[] = [];
  try {
    const quote = await getQuote(trade.ticker);
    parts.push(
      "Current price: $" + quote.price.toFixed(2) +
      " (" + (quote.changePercent >= 0 ? "+" : "") + quote.changePercent.toFixed(2) + "% today)"
    );
    const history = await getHistory(trade.ticker, "1mo");
    if (history.length > 5) {
      const monthAgo = history[0].close;
      const latest = history[history.length - 1].close;
      const change1m = ((latest - monthAgo) / monthAgo) * 100;
      parts.push("1-month change: " + (change1m >= 0 ? "+" : "") + change1m.toFixed(1) + "%");
    }
    if (trade.type === "OPTION") {
      const vol = await getRealizedVol(trade.ticker);
      if (vol != null) parts.push("30-day realized volatility (annualized): " + (vol * 100).toFixed(1) + "%");
      if (trade.strike != null) {
        const distancePct = ((trade.strike - quote.price) / quote.price) * 100;
        parts.push("Strike $" + trade.strike + " is " + Math.abs(distancePct).toFixed(1) + "% " + (distancePct >= 0 ? "above" : "below") + " current price");
      }
    }
  } catch (err) {
    parts.push("(Could not fetch live data: " + (err as Error).message + ")");
  }
  return parts.join(". ");
}

export async function generateTradeComment(trade: TradeContext): Promise<string> {
  const context = await buildContext(trade);
  const tradeDescription =
    trade.type === "OPTION"
      ? trade.side + " " + trade.quantity + " " + trade.ticker + " " + trade.strike + " " + trade.optionType + " @ $" + trade.entryPrice
      : trade.side + " " + trade.quantity + " shares of " + trade.ticker + " @ $" + trade.entryPrice;

  const systemPrompt = "You are a markets analyst giving brief, factual context on a paper trade. You do NOT give buy/sell advice or predictions. Describe what is notable given current conditions - recent price action, volatility, position sizing relative to typical risk. Keep it to 2-3 sentences, neutral and analytical. If the trade looks aggressive (large size, far OTM options, chasing a big recent move), say so plainly without being alarmist.";

  const userPrompt = "Trade: " + tradeDescription + "\n\nMarket context:\n" + context + "\n\nGive a brief analytical comment on this trade.";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "AI key not set.";

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 250, temperature: 0.7 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Gemini " + res.status + ": " + errText.slice(0, 200));
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : "No comment generated.";
}
