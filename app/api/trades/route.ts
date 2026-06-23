import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { generateTradeComment } from "../../../lib/ai";

const numOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v));

export async function GET() {
  const trades = await prisma.trade.findMany({ include: { aiComment: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(trades);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const trade = await prisma.trade.create({
    data: {
      ticker: String(body.ticker).toUpperCase(),
      type: body.type,
      side: body.side,
      quantity: Number(body.quantity),
      entryPrice: Number(body.entryPrice),
      stopLoss: numOrNull(body.stopLoss),
      target: numOrNull(body.target),
      optionType: body.optionType ?? null,
      strike: body.strike ? Number(body.strike) : null,
      expiration: body.expiration ?? null,
      strategy: body.strategy ?? null,
      notes: body.notes ?? null,
      emotion: body.emotion ?? null,
      rulesFollowed: body.rulesFollowed ?? true,
    },
  });

  let comment = "Trade logged.";
  try {
    comment = await generateTradeComment({
      ticker: trade.ticker,
      type: trade.type as "STOCK" | "OPTION" | "FUTURE",
      side: trade.side as "BUY" | "SELL",
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      optionType: trade.optionType as "CALL" | "PUT" | null,
      strike: trade.strike,
    });
  } catch (err) { comment = "AI failed, fallback comment: " + (err as Error).message; }

  const aiComment = await prisma.aiComment.create({ data: { tradeId: trade.id, text: comment } });
  return NextResponse.json({ ...trade, aiComment });
}
