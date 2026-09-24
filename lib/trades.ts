import { Prisma } from "@prisma/client";
import { generateTradeComment } from "./ai";
import { tradeApi, forDisplay } from "./trade-api";
export const owned = (id: string, userId: string) => ({
  id_userId: { id, userId },
});
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
  return (await tradeApi<Record<string, unknown>[]>(userId, "/v1/trades")).map(
    forDisplay,
  );
}
export async function readTrade(userId: string, id: string) {
  return forDisplay(
    await tradeApi(userId, "/v1/trades/" + encodeURIComponent(id)),
  );
}
export async function createTrade(userId: string, input: unknown) {
  const trade = forDisplay(await tradeApi(userId, "/v1/trades", "POST", input));
  let text = "AI unavailable. Paper trade recorded.";
  try {
    text = await generateTradeComment(trade);
  } catch {
    /* A provider failure must never undo a saved trade. */
  }
  try {
    trade.aiComment = await tradeApi(
      userId,
      "/v1/trades/" + trade.id + "/comments",
      "PATCH",
      { text },
    );
  } catch {
    /* The recorded trade remains authoritative. */
  }
  return trade;
}
export async function updateTrade(userId: string, id: string, input: unknown) {
  // Compatibility for existing clients. Java remains the only close implementation.
  if (
    input &&
    typeof input === "object" &&
    "status" in input &&
    input.status === "CLOSED" &&
    "exitPrice" in input &&
    Object.keys(input).length === 2
  )
    return closeTrade(userId, id, { exitPrice: input.exitPrice });
  return forDisplay(
    await tradeApi(
      userId,
      "/v1/trades/" + encodeURIComponent(id),
      "PATCH",
      input,
    ),
  );
}
export async function closeTrade(userId: string, id: string, input: unknown) {
  return forDisplay(
    await tradeApi(
      userId,
      "/v1/trades/" + encodeURIComponent(id) + "/close",
      "POST",
      input,
    ),
  );
}
export async function deleteTrade(userId: string, id: string) {
  return forDisplay(
    await tradeApi(userId, "/v1/trades/" + encodeURIComponent(id), "DELETE"),
  );
}
