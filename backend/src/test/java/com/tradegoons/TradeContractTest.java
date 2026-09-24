package com.tradegoons;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TradeContractTest {
  static Map<String, Object> input() {
    return new HashMap<>(
        Map.of(
            "ticker",
            "synth",
            "type",
            "STOCK",
            "side",
            "BUY",
            "quantity",
            "10",
            "entryPrice",
            "100"));
  }

  @ParameterizedTest
  @CsvSource({
    "quantity,0",
    "quantity,-1",
    "quantity,NaN",
    "quantity,1.1234567",
    "quantity,1000000000",
    "entryPrice,Infinity",
    "entryPrice,0",
    "entryPrice,1e3",
    "tradeDate,2026-02-30",
    "tradeDate,2026-13-01",
    "tradeDate,0000-01-01",
    "tradeDate,2026-2-01",
    "userId,attacker",
    "type,FUTURE",
    "side,SHORT",
    "mode,LIVE",
    "optionType,PUTT",
    "rulesFollowed,true"
  })
  void rejectsInvalid(String key, String value) {
    var input = input();
    input.put(key, value);
    assertThrows(ApiException.class, () -> TradeContract.validate(input));
  }

  @Test
  void normalizationAndDates() {
    var i = input();
    i.put("tradeDate", "2024-02-29");
    i.put("stopLoss", "");
    var t = TradeContract.validate(i);
    assertEquals("SYNTH", t.get("ticker"));
    assertEquals("10.000000", t.get("quantity").toString());
    assertNull(t.get("stopLoss"));
    assertEquals("PAPER", t.get("mode"));
  }

  @Test
  void optionsNeedWholeContractsAndDetails() {
    var i = input();
    i.put("type", "OPTION");
    assertThrows(ApiException.class, () -> TradeContract.validate(i));
    i.putAll(Map.of("strike", "100", "optionType", "CALL", "expiration", "2026-12-18"));
    assertDoesNotThrow(() -> TradeContract.validate(i));
    i.put("quantity", "0.5");
    assertThrows(ApiException.class, () -> TradeContract.validate(i));
  }

  @Test
  void nullUnknownAndLongValues() {
    var i = input();
    i.put("quantity", null);
    assertThrows(ApiException.class, () -> TradeContract.validate(i));
    var bad = input();
    bad.put("notes", "a".repeat(4001));
    assertThrows(ApiException.class, () -> TradeContract.validate(bad));
  }
}
