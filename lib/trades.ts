import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./http";
import {
  createTradeSchema,
  updateTradeSchema,
  type TradeInput,
} from "./contracts";
import { generateTradeComment } from "./ai";
export const owned = (id: string, userId: string) => ({
  id_userId: { id, userId },
});
export function tradeData(input: TradeInput) {
  return {
    ...input,
    tradeDate: input.tradeDate ? new Date(input.tradeDate) : null,
  };
}
// Numbers are a presentation-only compatibility layer for existing React components.
export type Presented<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends Array<infer U>
      ? Presented<U>[]
      : T extends object
        ? { [K in keyof T]: Presented<T[K]> }
        : T;
export function present<T>(value: T): Presented<T> {
  if (value instanceof Prisma.Decimal) return value.toNumber() as Presented<T>;
  if (value instanceof Date) return value.toISOString() as Presented<T>;
  if (Array.isArray(value)) return value.map(present) as Presented<T>;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, present(v)]),
    ) as Presented<T>;
  return value as Presented<T>;
}
export async function listTrades(userId: string) {
  return present(
    await prisma.trade.findMany({
      where: { userId },
      include: { aiComment: true },
      orderBy: { createdAt: "desc" },
    }),
  );
}
export async function readTrade(userId: string, id: string) {
  return present(
    await prisma.trade.findUniqueOrThrow({
      where: owned(id, userId),
      include: { aiComment: true },
    }),
  );
}
export async function createTrade(userId: string, input: unknown) {
  const data = createTradeSchema.parse(input);
  let text = "AI disabled. Paper trade recorded.";
  try {
    text = await generateTradeComment({
      ...data,
      quantity: Number(data.quantity),
      entryPrice: Number(data.entryPrice),
      strike: data.strike ? Number(data.strike) : null,
    });
  } catch {
    text = "AI unavailable. Paper trade recorded.";
  }
  return present(
    await prisma.trade.create({
      data: {
        ...tradeData(data),
        userId,
        aiComment: { create: { user: { connect: { id: userId } }, text } },
      },
      include: { aiComment: true },
    }),
  );
}
export async function updateTrade(userId: string, id: string, input: unknown) {
  const change = updateTradeSchema.parse(input);
  return present(
    await prisma.$transaction(async (tx) => {
      // Serializes competing edits/close/delete against the same owned row.
      await tx.$queryRaw`SELECT id FROM "Trade" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
      const old = await tx.trade.findUniqueOrThrow({
        where: owned(id, userId),
      });
      if (old.status === "CLOSED") {
        if (
          change.status === "CLOSED" &&
          old.exitPrice?.equals(change.exitPrice!)
        )
          return old;
        throw new ApiError(409, "CLOSED", "Closed trades are immutable.");
      }
      if (change.status === "CLOSED")
        return tx.trade.update({
          where: owned(id, userId),
          data: {
            status: "CLOSED",
            exitPrice: change.exitPrice,
            closedAt: new Date(),
          },
        });
      const {
        id: _,
        userId: __,
        createdAt: ___,
        closedAt: ____,
        status: _____,
        exitPrice: ______,
        importKey: _______,
        ...fields
      } = old;
      const valid = createTradeSchema.parse({
        ...fields,
        quantity: old.quantity.toString(),
        entryPrice: old.entryPrice.toString(),
        stopLoss: old.stopLoss?.toString() ?? null,
        target: old.target?.toString() ?? null,
        strike: old.strike?.toString() ?? null,
        tradeDate: old.tradeDate?.toISOString().slice(0, 10) ?? null,
        ...change,
      });
      return tx.trade.update({
        where: owned(id, userId),
        data: tradeData(valid),
      });
    }),
  );
}
export async function deleteTrade(userId: string, id: string) {
  return present(await prisma.trade.delete({ where: owned(id, userId) }));
}
