# Trade REST contract

The private Java service listens on `127.0.0.1:8080` by default. Browser clients use authenticated same-origin `/api/*` Next.js routes, not Java directly. `/health` is unauthenticated liveness and contains no data.

| Java route | Success | Meaning |
| --- | --- | --- |
| `POST /v1/trades` | 201 + trade | Validate and create a separate lot |
| `GET /v1/trades` | 200 + array | List only the signed owner's trades/comments |
| `GET /v1/trades/{id}` | 200 + trade | Owned trade or 404 |
| `PATCH /v1/trades/{id}` | 200 + trade | Merge allowed fields on an open trade |
| `POST /v1/trades/{id}/close` | 200 + trade | Atomic close; same-price retry is idempotent |
| `DELETE /v1/trades/{id}` | 200 + removed trade | Owned deletion with comment cascade |
| `GET/PATCH/DELETE /v1/trades/{id}/comments` | 200 | Owned nested resource; absent read is JSON null |
| `POST /v1/portfolio` | 200 + totals/positions | Decimal calculation using supplied trusted marks |
| `POST /v1/imports/preview` | 200 + rows | Validate a parsed CSV batch without writes |
| `POST /v1/imports/commit` | 200 + imported count | Atomic validated batch with duplicate suppression |

Next.js preserves the existing `/api/trades` response status for compatibility, forwards to these operations, and adds optional Gemini commentary after creation. A commentary failure cannot undo the saved trade. `/api/trades/{id}/close` is the UI close route. Legacy `PATCH {status:"CLOSED",exitPrice:...}` is translated to the same Java close endpoint; it has no separate business implementation.

## Request and response examples

```json
{"ticker":"DEMO","type":"STOCK","side":"BUY","quantity":"10","entryPrice":"100","mode":"PAPER","account":"Individual"}
```

Create requires ticker, type, side, quantity and entryPrice. Type is STOCK/OPTION; side BUY/SELL. Mode defaults to PAPER and account to Individual. Optional fields: stopLoss, target, strike, tradeDate, expiration, optionType, strategy, notes, emotion and rulesFollowed. Options require CALL/PUT, strike, valid expiration and whole contracts. FUTURE is rejected. Dates must be real `YYYY-MM-DD` dates. Unknown fields, including client ownership, are rejected.

Quantity/entry must be positive; exit/stops/targets/strike are nonnegative. Each is at most 999999999 with at most six decimal places. Decimal strings are preferred; JSON numbers are accepted through Jackson's decimal parsing. Scientific notation strings and nonfinite values are rejected. Text limits: ticker 15, account/emotion 80, strategy 120, notes/comment 4000. Null/empty optional form values are normalized where documented by `TradeContract`.

Edit can contain any nonempty subset of create fields; the full merged record is validated. Close accepts **only**:

```json
{"exitPrice":"110.005"}
```

The resulting trade contains `quantity:"12.500000"`, `exitPrice:"110.005000"`, `status:"CLOSED"`, a persisted `closedAt`, and `realizedPnl:"125.06"` when entry is 100 and quantity was edited to 12.5. The browser compatibility response additionally retains exact values in `decimals` and exposes legacy numeric display fields.

Portfolio input:

```json
{"mode":"PAPER","account":null,"startBalance":"100000","marks":{"SYNTH":{"price":"110","previousClose":"108"}}}
```

Mark values must be nonnegative valid decimals; previousClose is optional. Omitted marks are unavailable, not zero. Responses include realized, unrealized, equity, costBasis, marketValue, dayChange, dayPercent and winRate strings; per-position amounts; concentration; unpriced count and complete flag. The separate dayComplete flag is false when current or previous-close marks are missing; the UI then displays daily change as unavailable. The BFF attaches provider source/stale metadata. Equity is a reference balance plus P&L, and marketValue is gross exposure (not signed net liquidation value).

CSV endpoints receive an array of 1–500 parsed row objects. The Next.js layer parses quoting and row structure; Java returns row numbers/errors and duplicate flags. Commit rejects the whole batch if any row is invalid. Decimal normalization, key order and legacy fingerprint compatibility are tested.

## Errors and internal authentication

```json
{"code":"VALIDATION","error":"quantity: invalid value"}
```

400: malformed JSON/invalid input. 401: missing/invalid/expired/replayed signature or unavailable identity. 403: read-only account. 404: absent **or another owner's** record. 409: closed-state conflict or database constraint conflict. 413: oversized body. 500: unexpected internal error. 503: service unavailable. Next.js adds `TRADE_SERVICE_UNAVAILABLE` when the Java connection times out/fails. Responses are not cached.

Internal headers are `X-Trade-User`, `X-Trade-Time`, `X-Trade-Nonce`, and `X-Trade-Signature`. The signature is lowercase hex HMAC-SHA256 over newline-separated method, encoded path (including query), user ID, timestamp, nonce and lowercase SHA-256 hex of the exact UTF-8 body. The server rejects an altered body or owner. `scripts/benchmark.mjs` demonstrates signed requests using only an ignored local secret; never place that secret in client JavaScript.
