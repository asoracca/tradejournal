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
