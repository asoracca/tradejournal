import { z } from "zod";
import Decimal from "decimal.js";
const decimal = (positive = false) =>
  z
    .union([
      z
        .string()
        .regex(
          /^\d+(\.\d{1,6})?$/,
          "Use a positive decimal with at most six decimal places.",
        ),
      z.number().finite(),
    ])
    .transform((v) => new Decimal(v))
    .refine(
      (v) =>
        v.isFinite() &&
        (positive ? v.gt(0) : v.gte(0)) &&
        v.lte("999999999") &&
        v.decimalPlaces() <= 6,
      "Out of range or too many decimal places.",
    )
    .transform((v) => v.toFixed(6));
const nullableDecimal = z
  .preprocess((v) => (v === "" ? null : v), decimal().nullable())
  .optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Invalid calendar date");
const nullableDate = z
  .preprocess((v) => (v === "" ? null : v), date.nullable())
  .optional();
export const tradeFields = z
  .object({
    ticker: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9.=-]{0,14}$/),
    type: z.enum(["STOCK", "OPTION", "FUTURE"]),
    side: z.enum(["BUY", "SELL"]),
    quantity: decimal(true),
    entryPrice: decimal(true),
    stopLoss: nullableDecimal,
    target: nullableDecimal,
    strike: nullableDecimal,
    tradeDate: nullableDate,
    expiration: nullableDate,
    optionType: z.enum(["CALL", "PUT"]).nullable().optional(),
    mode: z.enum(["PAPER", "REAL"]).default("PAPER"),
    account: z.string().trim().min(1).max(80).default("Individual"),
    strategy: z.string().max(120).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    emotion: z.string().max(80).nullable().optional(),
    rulesFollowed: z.boolean().default(true),
  })
  .strict();
export const createTradeSchema = tradeFields.superRefine((v, ctx) => {
  if (v.type === "FUTURE")
    ctx.addIssue({
      code: "custom",
      path: ["type"],
      message:
        "Futures require contract multipliers and are not yet supported for new trades.",
    });
  if (
    v.type === "OPTION" &&
    (!v.optionType ||
      !v.strike ||
      !v.expiration ||
      !new Decimal(v.quantity).isInteger())
  )
    ctx.addIssue({
      code: "custom",
      path: ["optionType"],
      message: "Options require type, strike, expiration and whole contracts.",
    });
});
export const updateTradeSchema = tradeFields
  .partial()
  .extend({
    exitPrice: decimal().optional(),
    status: z.enum(["CLOSED"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Empty update")
  .refine(
    (v) =>
      (v.exitPrice === undefined && v.status === undefined) ||
      (v.exitPrice !== undefined &&
        v.status === "CLOSED" &&
        Object.keys(v).length === 2),
    "Close with only status CLOSED and exitPrice",
  );
export const assetSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80),
    value: decimal(),
  })
  .strict();
export const importSchema = z
  .object({
    csv: z.string().min(1).max(500000),
    commit: z.boolean().default(false),
  })
  .strict();
export type TradeInput = z.infer<typeof createTradeSchema>;
