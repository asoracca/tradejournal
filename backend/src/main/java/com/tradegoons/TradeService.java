package com.tradegoons;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TradeService {
  private final NamedParameterJdbcTemplate db;
  private final tools.jackson.databind.ObjectMapper json;

  TradeService(NamedParameterJdbcTemplate db, tools.jackson.databind.ObjectMapper json) {
    this.db = db;
    this.json = json;
  }

  private static final String SELECT =
      "SELECT t.*, c.id AS comment_id, c.text AS comment_text FROM public.\"Trade\" t LEFT JOIN"
          + " public.\"AiComment\" c ON c.\"tradeId\"=t.id AND c.\"userId\"=t.\"userId\" ";

  public List<Map<String, Object>> list(String user) {
    return db
        .queryForList(
            SELECT + "WHERE t.\"userId\"=:user ORDER BY t.\"createdAt\" DESC,t.id",
            Map.of("user", user))
        .stream()
        .map(this::present)
        .toList();
  }

  public List<Map<String, Object>> portfolioRows(String user, String mode, String account) {
    var p = new HashMap<String, Object>();
    p.put("user", user);
    p.put("mode", mode);
    p.put("account", account);
    return db.queryForList(
        "SELECT * FROM public.\"Trade\" WHERE \"userId\"=:user AND mode=:mode AND (CAST(:account AS"
            + " text) IS NULL OR account=:account)",
        p);
  }

  public Map<String, Object> read(String user, String id) {
    var rows =
        db.queryForList(
            SELECT + "WHERE t.\"userId\"=:user AND t.id=:id", Map.of("user", user, "id", id));
    if (rows.isEmpty()) throw ApiException.missing();
    return present(rows.getFirst());
  }

  Map<String, Object> present(Map<String, Object> raw) {
    var out = new LinkedHashMap<String, Object>();
    raw.forEach(
        (k, v) ->
            out.put(
                k,
                v instanceof BigDecimal d
                    ? d.toPlainString()
                    : v instanceof Timestamp t ? t.toInstant().toString() : v));
    Object commentId = out.remove("comment_id"), commentText = out.remove("comment_text");
    out.put(
        "aiComment",
        commentId == null
            ? null
            : Map.of(
                "id",
                commentId,
                "text",
                commentText,
                "userId",
                out.get("userId"),
                "tradeId",
                out.get("id")));
    BigDecimal realized =
        "CLOSED".equals(out.get("status"))
            ? Accounting.pnl(
                number(out, "entryPrice"),
                number(out, "exitPrice"),
                number(out, "quantity"),
                (String) out.get("side"),
                (String) out.get("type"))
            : Accounting.money(BigDecimal.ZERO);
    out.put("realizedPnl", realized.toPlainString());
    out.put(
        "costBasis",
        Accounting.money(
                number(out, "entryPrice")
                    .multiply(number(out, "quantity"))
                    .multiply(Accounting.multiplier((String) out.get("type"))))
            .toPlainString());
    out.put(
        "returnPercent",
        Accounting.percent(
                realized,
                number(out, "entryPrice")
                    .multiply(number(out, "quantity"))
                    .multiply(Accounting.multiplier((String) out.get("type"))))
            .toPlainString());
    return out;
  }

  static BigDecimal number(Map<String, Object> data, String key) {
    return new BigDecimal(data.get(key).toString());
  }

  private Map<String, Object> params(String user, Map<String, Object> data) {
    var p = new HashMap<>(data);
    p.put("user", user);
    p.put("id", UUID.randomUUID().toString());
    return p;
  }

  private record Inserted(String id, int count) {}

  private Inserted insert(String user, Map<String, Object> valid, String importKey) {
    var p = params(user, valid);
    p.put("importKey", importKey);
    String fields =
        TradeContract.FIELDS.stream()
            .sorted()
            .map(f -> "\"" + f + "\"")
            .collect(Collectors.joining(","));
    String values =
        TradeContract.FIELDS.stream()
            .sorted()
            .map(f -> f.equals("tradeDate") ? "CAST(:tradeDate AS timestamp)" : ":" + f)
            .collect(Collectors.joining(","));
    int count =
        db.update(
            "INSERT INTO public.\"Trade\" (id,\"userId\",\"importKey\","
                + fields
                + ") VALUES (:id,:user,:importKey,"
                + values
                + ") ON CONFLICT (\"userId\",\"importKey\") DO NOTHING",
            p);
    if (count > 0)
      db.update(
          "INSERT INTO public.\"AiComment\" (id,\"userId\",\"tradeId\",text) VALUES"
              + " (:comment,:user,:id,:text)",
          Map.of(
              "comment",
              UUID.randomUUID().toString(),
              "user",
              user,
              "id",
              p.get("id"),
              "text",
              "Paper trade recorded. AI commentary pending or disabled."));
    return new Inserted((String) p.get("id"), count);
  }

  @Transactional
  public Map<String, Object> create(String user, Map<String, Object> input) {
    var inserted = insert(user, TradeContract.validate(input), null);
    return read(user, inserted.id());
  }

  private Map<String, Object> lock(String user, String id) {
    var rows =
        db.queryForList(
            "SELECT * FROM public.\"Trade\" WHERE id=:id AND \"userId\"=:user FOR UPDATE",
            Map.of("id", id, "user", user));
    if (rows.isEmpty()) throw ApiException.missing();
    return rows.getFirst();
  }

  @Transactional
  public Map<String, Object> update(String user, String id, Map<String, Object> change) {
    if (change.isEmpty() || !TradeContract.FIELDS.containsAll(change.keySet()))
      throw ApiException.invalid("update");
    var old = lock(user, id);
    if ("CLOSED".equals(old.get("status")))
      throw new ApiException(409, "CLOSED", "Closed trades are immutable.");
    var fields = new HashMap<String, Object>();
    for (String f : TradeContract.FIELDS) {
      Object v = old.get(f);
      fields.put(f, v instanceof Timestamp t ? t.toInstant().toString().substring(0, 10) : v);
    }
    fields.putAll(change);
    var valid = TradeContract.validate(fields);
    var p = new HashMap<>(valid);
    p.put("id", id);
    p.put("user", user);
    String assignment =
        TradeContract.FIELDS.stream()
            .sorted()
            .map(
                f ->
                    "\""
                        + f
                        + "\"="
                        + (f.equals("tradeDate") ? "CAST(:tradeDate AS timestamp)" : ":" + f))
            .collect(Collectors.joining(","));
    db.update(
        "UPDATE public.\"Trade\" SET " + assignment + " WHERE id=:id AND \"userId\"=:user", p);
    return read(user, id);
  }

  @Transactional
  public Map<String, Object> close(String user, String id, Map<String, Object> input) {
    if (!input.keySet().equals(Set.of("exitPrice"))) throw ApiException.invalid("close");
    var exit = TradeContract.decimal(input.get("exitPrice"), "exitPrice", false);
    var old = lock(user, id);
    if ("CLOSED".equals(old.get("status"))) {
      if (number(old, "exitPrice").compareTo(exit) == 0) return read(user, id);
      throw new ApiException(409, "CLOSED", "Already closed at another price.");
    }
    db.update(
        "UPDATE public.\"Trade\" SET status='CLOSED',\"exitPrice\"=:exit,\"closedAt\"=:now WHERE"
            + " id=:id AND \"userId\"=:user",
        Map.of("exit", exit, "now", Timestamp.from(Instant.now()), "id", id, "user", user));
    return read(user, id);
  }

  @Transactional
  public Map<String, Object> delete(String user, String id) {
    lock(user, id);
    var old = read(user, id);
    db.update(
        "DELETE FROM public.\"Trade\" WHERE id=:id AND \"userId\"=:user",
        Map.of("id", id, "user", user));
    return old;
  }

  @Transactional
  public Object comment(String user, String id, String method, Map<String, Object> input) {
    lock(user, id);
    var trade = read(user, id);
    Object old = trade.get("aiComment");
    if (method.equals("GET")) return old;
    if (old == null) throw ApiException.missing();
    if (method.equals("DELETE"))
      db.update(
          "DELETE FROM public.\"AiComment\" WHERE \"tradeId\"=:id AND \"userId\"=:user",
          Map.of("id", id, "user", user));
    else {
      if (!input.keySet().equals(Set.of("text"))) throw ApiException.invalid("comment");
      String text = TradeContract.text(input.get("text"), "text", 4000, true);
      db.update(
          "UPDATE public.\"AiComment\" SET text=:text WHERE \"tradeId\"=:id AND \"userId\"=:user",
          Map.of("id", id, "user", user, "text", text));
      return read(user, id).get("aiComment");
    }
    return old;
  }

  // Import and UI writes call the same validator and insertion path; unique keys arbitrate
  // concurrent retries.
  @Transactional
  public Map<String, Object> imports(
      String user, List<Map<String, Object>> records, boolean commit) {
    if (records.isEmpty() || records.size() > 500) throw ApiException.invalid("rows");
    var rows = new ArrayList<Map<String, Object>>();
    var valid = new ArrayList<Map<String, Object>>();
    var keys = new ArrayList<String>();
    var seen = new HashSet<String>();
    boolean invalid = false;
    for (int i = 0; i < records.size(); i++) {
      var row = new LinkedHashMap<String, Object>();
      row.put("row", i + 2);
      try {
        var data = TradeContract.validate(records.get(i));
        var canonicalFields = new TreeMap<String, Object>();
        // Retain the previous CSV hash format so imports made before cutover remain idempotent.
        for (String field : data.keySet())
          if (records.get(i).containsKey(field)
              || Set.of("mode", "account", "rulesFollowed").contains(field)) {
            Object value = data.get(field);
            canonicalFields.put(field, value instanceof BigDecimal d ? d.toPlainString() : value);
          }
        String canonical = json.writeValueAsString(canonicalFields);
        String key =
            ServiceAuthentication.hex(
                java.security.MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        boolean duplicate =
            !seen.add(key)
                || Boolean.TRUE.equals(
                    db.queryForObject(
                        "SELECT EXISTS(SELECT 1 FROM public.\"Trade\" WHERE \"userId\"=:user AND"
                            + " \"importKey\"=:key)",
                        Map.of("user", user, "key", key),
                        Boolean.class));
        var previewData = new LinkedHashMap<String, Object>();
        data.forEach(
            (field, value) ->
                previewData.put(field, value instanceof BigDecimal d ? d.toPlainString() : value));
        row.put("data", previewData);
        row.put("errors", List.of());
        row.put("duplicate", duplicate);
        valid.add(data);
        keys.add(key);
      } catch (ApiException e) {
        row.put("errors", List.of(e.getMessage()));
        row.put("duplicate", false);
        invalid = true;
      } catch (java.security.GeneralSecurityException e) {
        throw new IllegalStateException(e);
      }
      rows.add(row);
    }
    if (commit && invalid)
      throw new ApiException(400, "CSV_VALIDATION", "Fix all preview errors before importing.");
    int imported = 0;
    if (commit)
      for (int i = 0; i < valid.size(); i++)
        imported += insert(user, valid.get(i), keys.get(i)).count();
    return Map.of("rows", rows, "imported", imported);
  }
}
