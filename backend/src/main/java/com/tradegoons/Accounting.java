package com.tradegoons;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** All authoritative money arithmetic; HALF_UP rounds ties away from zero. */
public final class Accounting {
  private Accounting() {}

  public static BigDecimal money(BigDecimal v) {
    return v.setScale(2, RoundingMode.HALF_UP);
  }

  public static BigDecimal multiplier(String type) {
    return new BigDecimal("OPTION".equals(type) ? "100" : "1");
  }

  public static BigDecimal pnl(
      BigDecimal entry, BigDecimal exit, BigDecimal qty, String side, String type) {
    return money(
        exit.subtract(entry)
            .multiply(qty)
            .multiply(multiplier(type))
            .multiply("SELL".equals(side) ? BigDecimal.ONE.negate() : BigDecimal.ONE));
  }

  public static BigDecimal percent(BigDecimal gain, BigDecimal basis) {
    return basis.signum() == 0
        ? money(BigDecimal.ZERO)
        : gain.multiply(new BigDecimal("100")).divide(basis, 2, RoundingMode.HALF_UP);
  }
}
