/**
 * lib/ai.ts
 * ---------
 * Generates short, analytical commentary on paper trades using Claude.
 *
 * DESIGN PRINCIPLE: the AI should NOT say "buy" or "sell" or give advice.
 * It should describe what's notable about the trade given current market
 * context — recent price action, volatility level, etc. This is more
 * defensible (and more interesting) than a black-box "signal."
 *
 * Set ANTHROPIC_API_KEY in your environment (.env.local for Next.js, or
 * Vercel environment variables for deploy).
 */

import Anthropic from "@anthropic-ai/sdk";
import { getQuote, getRealizedVol, getHistory } from "./marketData";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface TradeContext {
  ticker: string;
  type: "STOCK" | "OPTION" | "FUTURE";
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  optionType?: "CALL" | "PUT" | null;
  strike?: number | null;
}

/**
 * Build a short context string with real market data the AI can
 * reference — recent return, realized vol, distance from strike, etc.
 */
async function buildContext(trade: TradeContext): Promise<string> {
  const parts: string[] = [];

  try {
    const quote = await getQuote(trade.ticker);
    parts.push(
      `Current price: $${quote.price.toFixed(2)} ` +
        `(${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}% today)`
    );

    const history = await getHistory(trade.ticker, "1mo");
    if (history.length > 5) {
      const monthAgo = history[0].close;
      const latest = history[history.length - 1].close;
      const change1m = ((latest - monthAgo) / monthAgo) * 100;
      parts.push(`1-month change: ${change1m >= 0 ? "+" : ""}${change1m.toFixed(1)}%`);
    }

    if (trade.type === "OPTION") {
      const vol = await getRealizedVol(trade.ticker);
      if (vol != null) {
        parts.push(`30-day realized volatility (annualized): ${(vol * 100).toFixed(1)}%`);
      }
      if (trade.strike != null) {
        const distancePct = ((trade.strike - quote.price) / quote.price) * 100;
        parts.push(
          `Strike $${trade.strike} is ${Math.abs(distancePct).toFixed(1)}% ` +
            `${distancePct >= 0 ? "above" : "below"} current price`
        );
      }
    }
  } catch (err) {
    parts.push(`(Could not fetch live data: ${(err as Error).message})`);
  }

  return parts.join(". ");
}

/**
 * Generate a 2-3 sentence AI comment on a newly placed paper trade.
 */
export async function generateTradeComment(trade: TradeContext): Promise<string> {
  const context = await buildContext(trade);

  const tradeDescription =
    trade.type === "OPTION"
      ? `${trade.side} ${trade.quantity} ${trade.ticker} ${trade.strike} ${trade.optionType} @ $${trade.entryPrice}`
      : `${trade.side} ${trade.quantity} shares of ${trade.ticker} @ $${trade.entryPrice}`;

  const systemPrompt = `You are a markets analyst providing brief, factual context on a
paper trade. You do NOT give buy/sell advice or predictions. You describe what is
notable about the trade given current market conditions — recent price action,
volatility level, position sizing relative to typical risk. Keep it to 2-3 sentences,
neutral and analytical in tone. If the trade looks aggressive (large size, far OTM
options, chasing a big recent move), say so plainly without being alarmist.`;

  const userPrompt = `Trade: ${tradeDescription}

Market context:
${context}

Provide a brief analytical comment on this trade.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "No comment generated.";
}
