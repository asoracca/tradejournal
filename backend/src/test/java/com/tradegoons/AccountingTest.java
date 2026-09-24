package com.tradegoons;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AccountingTest {
  @ParameterizedTest
  @CsvSource({
    "100,110,10,BUY,STOCK,100.00",
    "120,110,5,SELL,STOCK,50.00",
    "1,1.5,2,BUY,OPTION,100.00",
    "0.1,0.2,0.1,BUY,STOCK,0.01",
    "1,1.005,1,BUY,STOCK,0.01",
    "1,0.995,1,BUY,STOCK,-0.01",
    "999999999,0,999999999,BUY,STOCK,-999999998000000001.00",
    "0.01,0,1,SELL,OPTION,1.00"
  })
  void decimalOracle(
      String entry, String exit, String qty, String side, String type, String expected) {
    assertEquals(
        expected,
        Accounting.pnl(new BigDecimal(entry), new BigDecimal(exit), new BigDecimal(qty), side, type)
            .toPlainString());
  }

  @Test
  void zeroBasisAndPercentage() {
    assertEquals("0.00", Accounting.percent(BigDecimal.ONE, BigDecimal.ZERO).toPlainString());
    assertEquals("33.33", Accounting.percent(BigDecimal.ONE, new BigDecimal("3")).toPlainString());
  }
}
