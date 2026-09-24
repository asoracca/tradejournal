package com.tradegoons;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class PortfolioService {
  public record Mark(BigDecimal price, BigDecimal previousClose) {}

  public record Request(
      String mode, String account, String startBalance, Map<String, Mark> marks) {}

  private final TradeService trades;

  PortfolioService(TradeService trades) {
    this.trades = trades;
  }

  public Map<String, Object> calculate(String user, Request request) {
    String mode =
        TradeContract.choice(
            request.mode() == null ? "PAPER" : request.mode(), "mode", "PAPER", "REAL");
    if (request.account() != null) TradeContract.text(request.account(), "account", 80, true);
    BigDecimal start =
        TradeContract.decimal(
            request.startBalance() == null ? "100000" : request.startBalance(),
            "startBalance",
            false);
    var marks = request.marks() == null ? Map.<String, Mark>of() : request.marks();
    if (marks.size() > 5000) throw ApiException.invalid("marks");
    for (var m : marks.values()) {
      if (m == null) throw ApiException.invalid("marks");
      TradeContract.decimal(m.price(), "mark.price", false);
      if (m.previousClose() != null)
        TradeContract.decimal(m.previousClose(), "mark.previousClose", false);
    }
    BigDecimal realized = BigDecimal.ZERO,
        unrealized = BigDecimal.ZERO,
        cost = BigDecimal.ZERO,
        market = BigDecimal.ZERO,
        day = BigDecimal.ZERO,
        previous = BigDecimal.ZERO;
    int unpriced = 0, missingPrevious = 0, wins = 0, closed = 0;
    var positions = new LinkedHashMap<String, Object>();
    var byTicker = new TreeMap<String, BigDecimal>();
    for (var t : trades.portfolioRows(user, mode, request.account())) {
      var entry = TradeService.number(t, "entryPrice");
      var qty = TradeService.number(t, "quantity");
      String side = (String) t.get("side"), type = (String) t.get("type");
      var basis = entry.multiply(qty).multiply(Accounting.multiplier(type));
      var pos = new LinkedHashMap<String, Object>();
      if ("CLOSED".equals(t.get("status"))) {
        var pnl = Accounting.pnl(entry, TradeService.number(t, "exitPrice"), qty, side, type);
        realized = realized.add(pnl);
        closed++;
        if (pnl.signum() > 0) wins++;
        pos.put("realized", pnl.toPlainString());
        pos.put("returnPercent", Accounting.percent(pnl, basis).toPlainString());
      } else {
        cost = cost.add(Accounting.money(basis));
        byTicker.merge((String) t.get("ticker"), Accounting.money(basis), BigDecimal::add);
        var mark = "STOCK".equals(type) ? marks.get(t.get("ticker")) : null;
        if (mark == null) {
          unpriced++;
          pos.put("unrealized", null);
          pos.put("marketValue", null);
          pos.put("returnPercent", null);
        } else {
          var pnl = Accounting.pnl(entry, mark.price(), qty, side, type);
          unrealized = unrealized.add(pnl);
          var value = Accounting.money(mark.price().multiply(qty));
          market = market.add(value);
          pos.put("unrealized", pnl.toPlainString());
          pos.put("marketValue", value.toPlainString());
          pos.put("returnPercent", Accounting.percent(pnl, basis).toPlainString());
          if (mark.previousClose() != null) {
            day = day.add(Accounting.pnl(mark.previousClose(), mark.price(), qty, side, type));
            previous = previous.add(Accounting.money(mark.previousClose().multiply(qty)));
          } else {
            missingPrevious++;
          }
        }
      }
      positions.put((String) t.get("id"), pos);
    }
    var result = new LinkedHashMap<String, Object>();
    result.put("realized", Accounting.money(realized).toPlainString());
    result.put("unrealized", Accounting.money(unrealized).toPlainString());
    result.put("equity", Accounting.money(start.add(realized).add(unrealized)).toPlainString());
    result.put("costBasis", Accounting.money(cost).toPlainString());
    result.put("marketValue", Accounting.money(market).toPlainString());
    result.put("dayChange", Accounting.money(day).toPlainString());
    result.put("dayPercent", Accounting.percent(day, previous).toPlainString());
    result.put(
        "winRate",
        Accounting.percent(BigDecimal.valueOf(wins), BigDecimal.valueOf(closed)).toPlainString());
    result.put("unpriced", unpriced);
    result.put("complete", unpriced == 0);
    result.put("dayComplete", unpriced == 0 && missingPrevious == 0);
    result.put("positions", positions);
    final BigDecimal totalCost = cost;
    result.put(
        "concentration",
        byTicker.entrySet().stream()
            .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
            .map(
                e ->
                    Map.of(
                        "ticker",
                        e.getKey(),
                        "notional",
                        e.getValue().toPlainString(),
                        "percent",
                        Accounting.percent(e.getValue(), totalCost).toPlainString()))
            .toList());
    return result;
  }
}
