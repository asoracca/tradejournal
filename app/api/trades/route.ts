import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { generateTradeComment } from "../../../lib/ai";

const numOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v));
const dateOrNull = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d; };

export async function GET() {
  const trades = await prisma.trade.findMany({ include: { aiComment: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(trades);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ticker = String(body.ticker).toUpperCase();
  const type = body.type, side = body.side;
  const mode = body.mode === "REAL" ? "REAL" : "PAPER";
  const account = body.account || "Individual";
  const qty = Number(body.quantity), entry = Number(body.entryPrice);
  const optionType = body.optionType ?? null;
  const strike = body.strike ? Number(body.strike) : null;
  const expiration = body.expiration ?? null;

  const existing = await prisma.trade.findFirst({
    where: { ticker, type, side, mode, account, status: "OPEN", ...(type === "OPTION" ? { optionType, strike, expiration } : {}) },
  });

  if (existing) {
    let newQty: number, newEntry: number;
    if (body.replace) { newQty = qty; newEntry = entry; }
    else { newQty = existing.quantity + qty; newEntry = newQty ? (existing.quantity * existing.entryPrice + qty * entry) / newQty : entry; }
    const updated = await prisma.trade.update({
      where: { id: existing.id },
      data: {
        quantity: newQty,
        entryPrice: Math.round(newEntry * 10000) / 10000,
        tradeDate: dateOrNull(body.tradeDate) ?? existing.tradeDate,
        stopLoss: numOrNull(body.stopLoss) ?? existing.stopLoss,
        target: numOrNull(body.target) ?? existing.target,
      },
      include: { aiComment: true },
    });
    return NextResponse.json({ ...updated, merged: true });
  }

  const trade = await prisma.trade.create({
    data: {
      ticker, type, side, mode, account, quantity: qty, entryPrice: entry,
      stopLoss: numOrNull(body.stopLoss), target: numOrNull(body.target), tradeDate: dateOrNull(body.tradeDate),
      optionType, strike, expiration,
      strategy: body.strategy ?? null, notes: body.notes ?? null, emotion: body.emotion ?? null, rulesFollowed: body.rulesFollowed ?? true,
    },
  });

  let comment = "Trade logged.";
  try {
    comment = await generateTradeComment({
      ticker: trade.ticker, type: trade.type as "STOCK" | "OPTION" | "FUTURE",
      side: trade.side as "BUY" | "SELL", quantity: trade.quantity, entryPrice: trade.entryPrice,
      optionType: trade.optionType as "CALL" | "PUT" | null, strike: trade.strike,
    });
  } catch (err) { comment = "AI failed, fallback comment: " + (err as Error).message; }

  const aiComment = await prisma.aiComment.create({ data: { tradeId: trade.id, text: comment } });
  return NextResponse.json({ ...trade, aiComment });
}
