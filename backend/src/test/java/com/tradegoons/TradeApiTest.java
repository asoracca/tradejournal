package com.tradegoons;

import static org.junit.jupiter.api.Assertions.*;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TradeApiTest {
  @Value("${local.server.port}")
  int port;

  @Value("${TRADE_SERVICE_SECRET}")
  String secret;

  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate db;
  final HttpClient client = HttpClient.newHttpClient();
  final String a = "java-test-a", b = "java-test-b", demo = "java-test-demo";

  @BeforeAll
  void seed() {
    String url = System.getenv("JDBC_DATABASE_URL");
    if (url == null
        || !url.matches("jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/tradegoons_test.*"))
      throw new IllegalStateException("Only disposable local tradegoons_test is allowed");
    for (String user : List.of(a, b, demo))
      db.update(
          "INSERT INTO public.\"User\" (id,email,\"passwordHash\",\"readOnly\") VALUES (?,?,?,?) ON"
              + " CONFLICT(id) DO NOTHING",
          user,
          user + "@example.test",
          "no-browser-login",
          user.equals(demo));
  }

  @AfterAll
  void clean() {
    for (String user : List.of(a, b, demo)) {
      db.update("DELETE FROM public.\"Trade\" WHERE \"userId\"=?", user);
      db.update("DELETE FROM public.\"User\" WHERE id=?", user);
    }
  }

  HttpRequest signed(String user, String method, String path, Object value, String nonce, long time)
      throws Exception {
    String body = value == null ? "" : json.writeValueAsString(value), stamp = Long.toString(time);
    String digest =
        ServiceAuthentication.hex(
            MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8)));
    String signature =
        ServiceAuthentication.sign(
            secret.getBytes(StandardCharsets.UTF_8),
            String.join("\n", method, path, user, stamp, nonce, digest));
    return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
        .header("Content-Type", "application/json")
        .header("X-Trade-User", user)
        .header("X-Trade-Time", stamp)
        .header("X-Trade-Nonce", nonce)
        .header("X-Trade-Signature", signature)
        .method(
            method,
            body.isEmpty()
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body))
        .build();
  }

  HttpResponse<String> call(String user, String method, String path, Object body) throws Exception {
    return client.send(
        signed(
            user, method, path, body, UUID.randomUUID().toString(), Instant.now().getEpochSecond()),
        HttpResponse.BodyHandlers.ofString());
  }

  Map<String, Object> data(HttpResponse<String> r) {
    return json.readValue(r.body(), Map.class);
  }

  String create(String user) throws Exception {
    var r = call(user, "POST", "/v1/trades", TradeContractTest.input());
    assertEquals(201, r.statusCode(), r.body());
    return (String) data(r).get("id");
  }

  @Test
  void lifecycleAndRounding() throws Exception {
    String id = create(a), path = "/v1/trades/" + id;
    assertEquals("10.000000", data(call(a, "GET", path, null)).get("quantity"));
    assertEquals(
        200, call(a, "PATCH", path, Map.of("quantity", "12.5", "notes", "edited")).statusCode());
    var close = call(a, "POST", path + "/close", Map.of("exitPrice", "110.005"));
    assertEquals(200, close.statusCode(), close.body());
    assertEquals("125.06", data(close).get("realizedPnl"));
    assertEquals(
        data(close).get("closedAt"),
        data(call(a, "POST", path + "/close", Map.of("exitPrice", "110.005"))).get("closedAt"));
    assertEquals(409, call(a, "PATCH", path, Map.of("notes", "closed edit")).statusCode());
    assertEquals(409, call(a, "POST", path + "/close", Map.of("exitPrice", "111")).statusCode());
    assertEquals(200, call(a, "DELETE", path, null).statusCode());
    assertEquals(404, call(a, "GET", path, null).statusCode());
  }

  @Test
  void ownershipIncludingCommentsAndReadonly() throws Exception {
    String id = create(b), path = "/v1/trades/" + id;
    assertFalse(call(a, "GET", "/v1/trades", null).body().contains(id));
    for (String method : List.of("GET", "PATCH", "DELETE")) {
      assertEquals(
          404,
          call(a, method, path, method.equals("PATCH") ? Map.of("notes", "attack") : null)
              .statusCode());
      assertEquals(
          404,
          call(
                  a,
                  method,
                  path + "/comments",
                  method.equals("PATCH") ? Map.of("text", "attack") : null)
              .statusCode());
    }
    assertEquals(404, call(a, "POST", path + "/close", Map.of("exitPrice", "1")).statusCode());
    assertEquals(403, call(demo, "POST", "/v1/trades", TradeContractTest.input()).statusCode());
    assertEquals(
        200, call(b, "PATCH", path + "/comments", Map.of("text", "a comment")).statusCode());
    assertEquals(200, call(b, "DELETE", path + "/comments", null).statusCode());
    assertEquals("null", call(b, "GET", path + "/comments", null).body());
    call(b, "DELETE", path, null);
  }

  @Test
  void invalidJsonBodyAndAmounts() throws Exception {
    for (var patch :
        List.of(
            Map.of("quantity", "-1"),
            Map.of("entryPrice", "1.1234567"),
            Map.of("tradeDate", "2026-02-30"),
            Map.of("userId", b))) {
      var input = TradeContractTest.input();
      input.putAll(patch);
      var r = call(a, "POST", "/v1/trades", input);
      assertEquals(400, r.statusCode(), r.body());
      assertEquals("VALIDATION", data(r).get("code"));
    }
    String id = create(a);
    assertEquals(400, call(a, "PATCH", "/v1/trades/" + id, Map.of()).statusCode());
    assertEquals(
        400,
        call(a, "POST", "/v1/trades/" + id + "/close", Map.of("exitPrice", "-1")).statusCode());
    call(a, "DELETE", "/v1/trades/" + id, null);
  }

  @Test
  void unsignedExpiredTamperedAndReplayedRequestsFail() throws Exception {
    assertEquals(
        401,
        client
            .send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/v1/trades"))
                    .build(),
                HttpResponse.BodyHandlers.ofString())
            .statusCode());
    assertEquals(
        401,
        client
            .send(
                signed(
                    a,
                    "GET",
                    "/v1/trades",
                    null,
                    UUID.randomUUID().toString(),
                    Instant.now().getEpochSecond() - 60),
                HttpResponse.BodyHandlers.ofString())
            .statusCode());
    var request =
        signed(
            a,
            "GET",
            "/v1/trades",
            null,
            UUID.randomUUID().toString(),
            Instant.now().getEpochSecond());
    assertEquals(200, client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode());
    assertEquals(401, client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode());
    var valid =
        signed(
            a,
            "POST",
            "/v1/trades",
            TradeContractTest.input(),
            UUID.randomUUID().toString(),
            Instant.now().getEpochSecond());
    var tampered = HttpRequest.newBuilder(valid.uri());
    valid.headers().map().forEach((k, v) -> tampered.header(k, v.getFirst()));
    assertEquals(
        401,
        client
            .send(
                tampered.POST(HttpRequest.BodyPublishers.ofString("{} ")).build(),
                HttpResponse.BodyHandlers.ofString())
            .statusCode());
  }

  @Test
  void concurrentClosesProduceOneStableResult() throws Exception {
    String id = create(a);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var calls =
          pool.invokeAll(
              List.<Callable<HttpResponse<String>>>of(
                  () -> call(a, "POST", "/v1/trades/" + id + "/close", Map.of("exitPrice", "110")),
                  () ->
                      call(a, "POST", "/v1/trades/" + id + "/close", Map.of("exitPrice", "110"))));
      var first = calls.get(0).get();
      var second = calls.get(1).get();
      assertEquals(200, first.statusCode());
      assertEquals(200, second.statusCode());
      assertEquals(data(first).get("closedAt"), data(second).get("closedAt"));
    }
    call(a, "DELETE", "/v1/trades/" + id, null);
  }

  @Test
  void importsAtomicIdempotentAndTenantScoped() throws Exception {
    var row = TradeContractTest.input();
    row.put("ticker", "JCSV");
    var rows = List.of(row);
    assertEquals(0, data(call(a, "POST", "/v1/imports/preview", rows)).get("imported"));
    var preview = json.readTree(call(a, "POST", "/v1/imports/preview", rows).body());
    assertTrue(preview.get("rows").get(0).get("data").get("quantity").isString());
    try (var pool = Executors.newFixedThreadPool(2)) {
      var calls =
          pool.invokeAll(
              List.<Callable<HttpResponse<String>>>of(
                  () -> call(a, "POST", "/v1/imports/commit", rows),
                  () -> call(a, "POST", "/v1/imports/commit", rows)));
      assertEquals(
          1,
          ((Number) data(calls.get(0).get()).get("imported")).intValue()
              + ((Number) data(calls.get(1).get()).get("imported")).intValue());
    }
    assertEquals(1, data(call(b, "POST", "/v1/imports/commit", rows)).get("imported"));
    var invalid = TradeContractTest.input();
    invalid.put("quantity", "-1");
    assertEquals(400, call(a, "POST", "/v1/imports/commit", List.of(row, invalid)).statusCode());
    assertTrue(
        call(a, "POST", "/v1/imports/preview", List.of(invalid)).body().contains("quantity"));
    db.update("DELETE FROM public.\"Trade\" WHERE ticker='JCSV' AND \"userId\" IN (?,?)", a, b);
  }

  @Test
  void portfolioExactMissingMarksAndAccountFilters() throws Exception {
    String id = create(a);
    var closed = create(a);
    call(a, "POST", "/v1/trades/" + closed + "/close", Map.of("exitPrice", "110"));
    var request =
        Map.of(
            "mode",
            "PAPER",
            "startBalance",
            "1000",
            "marks",
            Map.of("SYNTH", Map.of("price", "110", "previousClose", "108")));
    var p = data(call(a, "POST", "/v1/portfolio", request));
    assertEquals("100.00", p.get("realized"));
    assertEquals("100.00", p.get("unrealized"));
    assertEquals("1200.00", p.get("equity"));
    assertEquals("20.00", p.get("dayChange"));
    assertEquals(true, p.get("dayComplete"));
    var missingPrevious =
        data(
            call(
                a,
                "POST",
                "/v1/portfolio",
                Map.of("marks", Map.of("SYNTH", Map.of("price", "110")))));
    assertEquals(false, missingPrevious.get("dayComplete"));
    assertEquals("1000.00", p.get("costBasis"));
    assertEquals("1100.00", p.get("marketValue"));
    assertEquals(
        "100.00", ((Map<?, ?>) ((List<?>) p.get("concentration")).getFirst()).get("percent"));
    var missing = data(call(a, "POST", "/v1/portfolio", Map.of("marks", Map.of())));
    assertEquals(1, missing.get("unpriced"));
    assertEquals(false, missing.get("complete"));
    assertEquals(false, missing.get("dayComplete"));
    assertEquals(
        "0.00",
        data(call(a, "POST", "/v1/portfolio", Map.of("account", "other", "marks", Map.of())))
            .get("realized"));
    assertEquals(
        400,
        call(a, "POST", "/v1/portfolio", Map.of("marks", Map.of("SYNTH", Map.of("price", "-1"))))
            .statusCode());
    call(a, "DELETE", "/v1/trades/" + id, null);
    call(a, "DELETE", "/v1/trades/" + closed, null);
  }

  @Test
  void postgresConstraintsAndRuntimePrivileges() {
    var role =
        db.queryForMap(
            "SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE"
                + " rolname=current_user");
    assertTrue(role.values().stream().noneMatch(Boolean.TRUE::equals));
    assertThrows(Exception.class, () -> db.queryForList("SELECT * FROM legacy_unowned.\"Trade\""));
    assertThrows(
        Exception.class,
        () ->
            db.update(
                "INSERT INTO public.\"Trade\""
                    + " (id,\"userId\",ticker,type,side,quantity,\"entryPrice\") VALUES"
                    + " ('bad-java',?,'BAD','STOCK','BUY',-1,1)",
                a));
  }

  @Test
  void preservesLegacyCsvFingerprint() throws Exception {
    String key = "4cd40d4fb2ad8887f01431b4568db1f5c04b5f2d31b005ff4f9cc989e9d358f9";
    db.update(
        "INSERT INTO public.\"Trade\""
            + " (id,\"userId\",ticker,type,side,quantity,\"entryPrice\",\"importKey\") VALUES"
            + " ('java-legacy-csv',?,'LEGACYCSV','STOCK','BUY',10,100,?)",
        a,
        key);
    var row = TradeContractTest.input();
    row.put("ticker", "LEGACYCSV");
    assertEquals(0, data(call(a, "POST", "/v1/imports/commit", List.of(row))).get("imported"));
    call(a, "DELETE", "/v1/trades/java-legacy-csv", null);
  }

  @Test
  void optionMultiplierAndMissingContractMarks() throws Exception {
    var option = TradeContractTest.input();
    option.putAll(
        Map.of(
            "type",
            "OPTION",
            "quantity",
            "1",
            "entryPrice",
            "2",
            "optionType",
            "CALL",
            "strike",
            "100",
            "expiration",
            "2026-12-18"));
    var created = call(a, "POST", "/v1/trades", option);
    assertEquals(201, created.statusCode());
    String id = (String) data(created).get("id");
    var totals =
        data(
            call(
                a,
                "POST",
                "/v1/portfolio",
                Map.of("marks", Map.of("SYNTH", Map.of("price", "110")))));
    assertEquals(1, totals.get("unpriced"));
    assertEquals("0.00", totals.get("unrealized"));
    assertEquals(
        "50.00",
        data(call(a, "POST", "/v1/trades/" + id + "/close", Map.of("exitPrice", "2.5")))
            .get("realizedPnl"));
    call(a, "DELETE", "/v1/trades/" + id, null);
  }

  @Test
  void malformedShapeDisabledAccountAndUnknownOperation() throws Exception {
    var malformed = call(a, "POST", "/v1/trades", "not an object");
    assertEquals(400, malformed.statusCode());
    assertEquals("INVALID_JSON", data(malformed).get("code"));
    assertEquals(
        404,
        call(a, "POST", "/v1/imports/unknown", List.of(TradeContractTest.input())).statusCode());
    db.update("UPDATE public.\"User\" SET disabled=true WHERE id=?", a);
    try {
      assertEquals(401, call(a, "GET", "/v1/trades", null).statusCode());
    } finally {
      db.update("UPDATE public.\"User\" SET disabled=false WHERE id=?", a);
    }
  }
}
