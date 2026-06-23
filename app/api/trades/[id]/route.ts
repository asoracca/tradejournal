import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const trade = await prisma.trade.findUnique({ where: { id: params.id }, include: { aiComment: true } });
  if (!trade) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(trade);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.ticker !== undefined) data.ticker = String(body.ticker).toUpperCase();
  if (body.type !== undefined) data.type = body.type;
  if (body.side !== undefined) data.side = body.side;
  if (body.quantity !== undefined) data.quantity = Number(body.quantity);
  if (body.entryPrice !== undefined) data.entryPrice = Number(body.entryPrice);
  if (body.exitPrice !== undefined) data.exitPrice = body.exitPrice === null ? null : Number(body.exitPrice);
  if (body.status !== undefined) data.status = body.status;
  if (body.optionType !== undefined) data.optionType = body.optionType || null;
  if (body.strike !== undefined) data.strike = body.strike ? Number(body.strike) : null;
  if (body.expiration !== undefined) data.expiration = body.expiration || null;
  if (body.strategy !== undefined) data.strategy = body.strategy || null;
  if (body.notes !== undefined) data.notes = body.notes;
  const trade = await prisma.trade.update({ where: { id: params.id }, data });
  return NextResponse.json(trade);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.aiComment.deleteMany({ where: { tradeId: params.id } });
  const trade = await prisma.trade.delete({ where: { id: params.id } });
  return NextResponse.json(trade);
}
