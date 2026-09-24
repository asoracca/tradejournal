package com.tradegoons;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/** Canonical server contract for UI, CSV and direct REST writes. */
public final class TradeContract {
  static final Set<String> FIELDS =
      Set.of(
          "ticker",
          "type",
          "side",
          "quantity",
          "entryPrice",
          "stopLoss",
          "target",
          "strike",
          "tradeDate",
          "expiration",
          "optionType",
          "mode",
          "account",
          "strategy",
          "notes",
          "emotion",
          "rulesFollowed");
  static final List<String> MONEY =
      List.of("quantity", "entryPrice", "stopLoss", "target", "strike");

  private TradeContract() {}

  public static BigDecimal decimal(Object v, String field, boolean positive) {
    if (v == null
        || !(v instanceof String || v instanceof Number)
        || !v.toString().matches("\\d+(\\.\\d{1,6})?")) throw ApiException.invalid(field);
    var n = new BigDecimal(v.toString());
    if (n.compareTo(new BigDecimal("999999999")) > 0
        || (positive ? n.signum() <= 0 : n.signum() < 0)) throw ApiException.invalid(field);
    return n.setScale(6);
  }

  static String text(Object v, String field, int max, boolean required) {
    if (v == null && !required) return null;
    if (!(v instanceof String s) || s.length() > max || (required && s.isBlank()))
      throw ApiException.invalid(field);
    return (String) v;
  }

  static String choice(Object v, String field, String... values) {
    if (!(v instanceof String s) || !Arrays.asList(values).contains(s))
      throw ApiException.invalid(field);
    return (String) v;
  }

  static String date(Object v, String field) {
    if (v == null || "".equals(v)) return null;
    if (!(v instanceof String s) || !s.matches("\\d{4}-\\d{2}-\\d{2}"))
      throw ApiException.invalid(field);
    try {
      if ((!LocalDate.parse((String) v).toString().equals(v)
          || LocalDate.parse((String) v).getYear() < 1)) throw ApiException.invalid(field);
      return (String) v;
    } catch (DateTimeParseException e) {
      throw ApiException.invalid(field);
    }
  }

  public static Map<String, Object> validate(Map<String, Object> input) {
    if (!FIELDS.containsAll(input.keySet())) throw ApiException.invalid("unknown field");
    var v = new LinkedHashMap<>(input);
    String ticker = text(v.get("ticker"), "ticker", 15, true).trim().toUpperCase(Locale.ROOT);
    if (!ticker.matches("[A-Z][A-Z0-9.=-]{0,14}")) throw ApiException.invalid("ticker");
    v.put("ticker", ticker);
    v.put("type", choice(v.get("type"), "type", "STOCK", "OPTION"));
    v.put("side", choice(v.get("side"), "side", "BUY", "SELL"));
    for (String f : MONEY) {
      Object x = v.get(f);
      boolean required = Set.of("quantity", "entryPrice").contains(f);
      v.put(f, !required && (x == null || "".equals(x)) ? null : decimal(x, f, required));
    }
    v.put("mode", choice(v.getOrDefault("mode", "PAPER"), "mode", "PAPER", "REAL"));
    v.put("account", text(v.getOrDefault("account", "Individual"), "account", 80, true).trim());
    for (var e : Map.of("strategy", 120, "notes", 4000, "emotion", 80).entrySet())
      v.put(e.getKey(), text(v.get(e.getKey()), e.getKey(), e.getValue(), false));
    v.put("tradeDate", date(v.get("tradeDate"), "tradeDate"));
    v.put("expiration", date(v.get("expiration"), "expiration"));
    Object option = v.get("optionType");
    if (option != null) choice(option, "optionType", "CALL", "PUT");
    v.put("optionType", option);
    if ("OPTION".equals(v.get("type"))
        && (option == null
            || v.get("strike") == null
            || v.get("expiration") == null
            || ((BigDecimal) v.get("quantity")).stripTrailingZeros().scale() > 0))
      throw ApiException.invalid("optionType");
    Object rules = v.getOrDefault("rulesFollowed", true);
    if (!(rules instanceof Boolean)) throw ApiException.invalid("rulesFollowed");
    v.put("rulesFollowed", rules);
    return v;
  }
}
