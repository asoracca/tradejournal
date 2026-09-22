import Decimal from "decimal.js";
Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
export function pnl(
  entry: Decimal.Value,
  exit: Decimal.Value,
  quantity: Decimal.Value,
  side: string,
  type: string,
) {
  return new Decimal(exit)
    .minus(entry)
    .times(quantity)
    .times(side === "SELL" ? -1 : 1)
    .times(type === "OPTION" ? 100 : 1)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
