import { it, expect, vi } from "vitest";
import { generateTradeComment } from "../lib/ai";
const trade = {
  ticker: "SYNTH",
  type: "STOCK",
  side: "BUY",
  quantity: "10",
  entryPrice: "100",
};
it("disabled Gemini never fetches", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  const fetch = vi.spyOn(globalThis, "fetch");
  expect(
    await generateTradeComment({
      ...trade,
      type: "STOCK",
      side: "BUY",
      quantity: 10,
      entryPrice: 100,
    }),
  ).toContain("disabled");
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

import { csvCell, parseCsv } from "../lib/csv";
import { quoteAdapter } from "../lib/marketData";
it.each(["=SUM(A1:A2)", " +1", "@cmd", "-1", "\t=1", "\n=1"])(
  "escapes spreadsheet text %j",
  (text) => expect(csvCell(text)).toMatch(/^"'/),
);
it("handles quoted CSV and reports row errors", () => {
  const rows = parseCsv(
    'ticker,type,side,quantity,entryPrice,notes\nSYNTH,STOCK,BUY,1,100,"one, two"\nBAD,STOCK,BUY,-1,100,invalid',
  );
  expect(rows[0].notes).toBe("one, two");
  expect(rows[1].quantity).toBe("-1"); // Semantic validation belongs to Java.
});
it("quote cache labels stale fallback and timeout honestly", async () => {
  let now = 1000000;
  const provider = vi.fn().mockResolvedValue({
    ticker: "TEST",
    price: 100,
    previousClose: 99,
    marketTime: 1000,
    currency: "USD",
    changePercent: 1,
  });
  const get = quoteAdapter(provider, () => now, 10);
  expect((await get("TEST")).stale).toBe(false);
  await get("TEST");
  expect(provider).toHaveBeenCalledTimes(1);
  now += 31000;
  provider.mockRejectedValue(Error("outage"));
  expect((await get("TEST")).stale).toBe(true);
  await expect(get("NEW")).rejects.toThrow("unavailable");
  await expect(
    quoteAdapter(
      () => new Promise(() => {}),
      () => now,
      5,
    )("WAIT"),
  ).rejects.toThrow("unavailable");
});
it("Gemini provider failures do not become fabricated commentary", async () => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-test-only");
  vi.stubEnv("MARKET_DATA_MODE", "synthetic");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("", { status: 503 }),
  );
  await expect(
    generateTradeComment({
      ticker: "TEST",
      type: "STOCK",
      side: "BUY",
      quantity: 1,
      entryPrice: 1,
    }),
  ).rejects.toThrow("Gemini");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
