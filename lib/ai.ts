/**
 * lib/ai.ts — AI trade commentary via Google Gemini (free tier).
 * Narrative, teaching-style feedback. Never buy/sell advice.
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
    parts.push("Current price: $" + quote.price.toFixed(2) + " (" + (quote.changePercent >= 0 ? "+" : "") + quote.changePercent.toFixed(2) + "% today)");
    const history = await getHistory(trade.ticker, "1mo");
    if (history.length > 5) {
      const change1m = ((history[history.length - 1].close - history[0].close) / history[0].close) * 100;
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
      : trade.side + " " + trade.quantity + " " + trade.ticker + " @ $" + trade.entryPrice;

  const systemPrompt = "You are a warm, plain-spoken trading mentor giving feedback on a paper trade to a beginner. In 3-4 sentences, explain what is notable and WHY - don't just list stats, explain what they mean. If the instrument is unusual (a 3x leveraged ETF like SOXL/KORU, a far out-of-the-money option, a high-volatility small cap), explain the mechanic plainly, e.g. 'this is a 3x leveraged ETF, so a 5% market move becomes a 15% swing, and it loses value if held through choppy periods.' Call out specifically and concretely why a trade is risky or aggressive if it is. Be encouraging, never alarmist, and never give buy/sell advice or price predictions.";

  const userPrompt = "Trade: " + tradeDescription + "\n\nMarket context:\n" + context + "\n\nGive your mentor-style comment.";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "AI key not set.";

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } },
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
