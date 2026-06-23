import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: { exitPrice?: number; status?: string } = {};
  if (body.exitPrice !== undefined) data.exitPrice = Number(body.exitPrice);
  if (body.status !== undefined) data.status = body.status;
  const trade = await prisma.trade.update({ where: { id: params.id }, data });
  return NextResponse.json(trade);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.aiComment.deleteMany({ where: { tradeId: params.id } });
  const trade = await prisma.trade.delete({ where: { id: params.id } });
  return NextResponse.json(trade);
}
