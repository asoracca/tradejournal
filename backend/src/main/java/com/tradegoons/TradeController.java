package com.tradegoons;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class TradeController {
  private final TradeService trades;
  private final PortfolioService portfolio;
  private final tools.jackson.databind.ObjectMapper json;

  TradeController(
      TradeService trades, PortfolioService portfolio, tools.jackson.databind.ObjectMapper json) {
    this.trades = trades;
    this.portfolio = portfolio;
    this.json = json;
  }

  private String owner(HttpServletRequest r) {
    return (String) r.getAttribute("owner");
  }

  @GetMapping("/health")
  Map<String, String> health() {
    return Map.of("status", "up");
  }

  @GetMapping("/v1/trades")
  Object list(HttpServletRequest r) {
    return trades.list(owner(r));
  }

  @PostMapping("/v1/trades")
  @ResponseStatus(HttpStatus.CREATED)
  Object create(HttpServletRequest r, @RequestBody Map<String, Object> body) {
    return trades.create(owner(r), body);
  }

  @GetMapping("/v1/trades/{id}")
  Object read(HttpServletRequest r, @PathVariable String id) {
    return trades.read(owner(r), id);
  }

  @PatchMapping("/v1/trades/{id}")
  Object update(
      HttpServletRequest r, @PathVariable String id, @RequestBody Map<String, Object> body) {
    return trades.update(owner(r), id, body);
  }

  @PostMapping("/v1/trades/{id}/close")
  Object close(
      HttpServletRequest r, @PathVariable String id, @RequestBody Map<String, Object> body) {
    return trades.close(owner(r), id, body);
  }

  @DeleteMapping("/v1/trades/{id}")
  Object delete(HttpServletRequest r, @PathVariable String id) {
    return trades.delete(owner(r), id);
  }

  @GetMapping("/v1/trades/{id}/comments")
  Object comments(HttpServletRequest r, @PathVariable String id) {
    return json.valueToTree(trades.comment(owner(r), id, "GET", Map.of()));
  }

  @PatchMapping("/v1/trades/{id}/comments")
  Object comment(
      HttpServletRequest r, @PathVariable String id, @RequestBody Map<String, Object> body) {
    return trades.comment(owner(r), id, "PATCH", body);
  }

  @DeleteMapping("/v1/trades/{id}/comments")
  Object removeComment(HttpServletRequest r, @PathVariable String id) {
    return trades.comment(owner(r), id, "DELETE", Map.of());
  }

  @PostMapping("/v1/portfolio")
  Object portfolio(HttpServletRequest r, @RequestBody PortfolioService.Request body) {
    return portfolio.calculate(owner(r), body);
  }

  @PostMapping("/v1/imports/{action}")
  Object imports(
      HttpServletRequest r,
      @PathVariable String action,
      @RequestBody List<Map<String, Object>> rows) {
    if (!Set.of("preview", "commit").contains(action)) throw ApiException.missing();
    return trades.imports(owner(r), rows, action.equals("commit"));
  }
}
