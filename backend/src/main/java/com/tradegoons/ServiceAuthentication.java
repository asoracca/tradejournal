package com.tradegoons;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/** Internal BFF authentication. Never trust an unsigned browser-supplied owner header. */
@Component
public class ServiceAuthentication extends OncePerRequestFilter {
  private final byte[] secret;
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final ConcurrentHashMap<String, Long> nonces = new ConcurrentHashMap<>();

  ServiceAuthentication(
      @Value("${TRADE_SERVICE_SECRET}") String secret, JdbcTemplate jdbc, ObjectMapper json) {
    if (secret.length() < 32)
      throw new IllegalArgumentException("TRADE_SERVICE_SECRET must have at least 32 characters");
    this.secret = secret.getBytes(StandardCharsets.UTF_8);
    this.jdbc = jdbc;
    this.json = json;
  }

  static String hex(byte[] b) {
    return HexFormat.of().formatHex(b);
  }

  static String sign(byte[] key, String message) throws GeneralSecurityException {
    var mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(key, "HmacSHA256"));
    return hex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws IOException, ServletException {
    res.setHeader("Cache-Control", "no-store");
    if (req.getRequestURI().equals("/health") && req.getMethod().equals("GET")) {
      chain.doFilter(req, res);
      return;
    }
    try {
      byte[] bytes = req.getInputStream().readNBytes(1_000_001);
      if (bytes.length > 1_000_000) throw new ApiException(413, "TOO_LARGE", "Request too large.");
      String user = req.getHeader("X-Trade-User"),
          time = req.getHeader("X-Trade-Time"),
          nonce = req.getHeader("X-Trade-Nonce"),
          signature = req.getHeader("X-Trade-Signature");
      long now = Instant.now().getEpochSecond(), stamp;
      try {
        stamp = Long.parseLong(time);
      } catch (Exception e) {
        throw unauthorized();
      }
      if (user == null
          || !user.matches("[A-Za-z0-9_-]{1,100}")
          || nonce == null
          || !nonce.matches("[A-Za-z0-9-]{20,80}")
          || signature == null
          || Math.abs(now - stamp) > 30) throw unauthorized();
      String path =
          req.getRequestURI() + (req.getQueryString() == null ? "" : "?" + req.getQueryString());
      String message =
          String.join(
              "\n",
              req.getMethod(),
              path,
              user,
              time,
              nonce,
              hex(MessageDigest.getInstance("SHA-256").digest(bytes)));
      if (!MessageDigest.isEqual(
          sign(secret, message).getBytes(StandardCharsets.UTF_8),
          signature.getBytes(StandardCharsets.UTF_8))) throw unauthorized();
      nonces.entrySet().removeIf(e -> e.getValue() < now - 60);
      if (nonces.size() > 10000) throw new ApiException(503, "BUSY", "Please retry later.");
      if (nonces.putIfAbsent(nonce, now) != null) throw unauthorized();
      var users =
          jdbc.queryForList("SELECT disabled, \"readOnly\" FROM public.\"User\" WHERE id=?", user);
      if (users.isEmpty() || Boolean.TRUE.equals(users.getFirst().get("disabled")))
        throw unauthorized();
      boolean write =
          !req.getMethod().equals("GET")
              && !Set.of("/v1/portfolio", "/v1/imports/preview").contains(req.getRequestURI());
      if (write && Boolean.TRUE.equals(users.getFirst().get("readOnly")))
        throw new ApiException(403, "READ_ONLY", "This demo account is read-only.");
      req.setAttribute("owner", user);
      chain.doFilter(
          new HttpServletRequestWrapper(req) {
            @Override
            public ServletInputStream getInputStream() {
              var in = new ByteArrayInputStream(bytes);
              return new ServletInputStream() {
                public int read() {
                  return in.read();
                }

                public boolean isFinished() {
                  return in.available() == 0;
                }

                public boolean isReady() {
                  return true;
                }

                public void setReadListener(ReadListener l) {
                  throw new UnsupportedOperationException();
                }
              };
            }

            @Override
            public BufferedReader getReader() {
              return new BufferedReader(
                  new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
            }
          },
          res);
    } catch (ApiException e) {
      res.setStatus(e.status);
      res.setContentType("application/json");
      res.getWriter()
          .write(json.writeValueAsString(Map.of("code", e.code, "error", e.getMessage())));
    } catch (org.springframework.dao.DataAccessException e) {
      res.setStatus(503);
      res.setContentType("application/json");
      res.getWriter()
          .write(
              json.writeValueAsString(
                  Map.of("code", "UNAVAILABLE", "error", "Trade service unavailable.")));
    } catch (GeneralSecurityException e) {
      throw new ServletException(e);
    }
  }

  private ApiException unauthorized() {
    return new ApiException(401, "UNAUTHENTICATED", "Valid service identity required.");
  }
}
