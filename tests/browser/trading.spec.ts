import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"));
async function login(page: Page, id: string) {
  const a = accounts.find((a: { id: string }) => a.id === id);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Paper Trading Desk" }),
  ).toBeVisible();
}
const origin = { Origin: "http://127.0.0.1:3000" };
test("two users: private trading and denied cross-user requests", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  await login(a, "synthetic-a");
  await login(b, "synthetic-b");
  await expect(
    a.getByText("Synthetic quotes — fixed demo inputs, not market prices."),
  ).toBeVisible();
  const list = await a.request.get("/api/trades");
  expect(list.ok()).toBeTruthy();
  expect(
    (await list.json()).every(
      (t: { userId: string }) => t.userId === "synthetic-a",
    ),
  ).toBeTruthy();
  const id = "synthetic-b-open";
  for (const method of ["get", "patch", "delete"] as const) {
    const res = await a.request[method]("/api/trades/" + id, {
      headers: origin,
      ...(method === "patch" ? { data: { notes: "attack" } } : {}),
    });
    expect(res.status()).toBe(404);
  }
  expect(
    (await (await b.request.get("/api/trades/" + id)).json()).notes,
  ).toContain("Synthetic");
  await a.getByRole("button", { name: "+ New Position", exact: true }).click();
  await a.getByLabel("Ticker", { exact: true }).fill("DEMO");
  await a.getByLabel("Quantity", { exact: true }).fill("10");
  await a.getByLabel("Entry Price", { exact: true }).fill("100");
  await a.getByRole("button", { name: "Add Position", exact: true }).click();
  await expect(a.getByTestId("position-DEMO")).toBeVisible();
  const trades = await (await a.request.get("/api/trades")).json();
  const trade = trades.find((t: { ticker: string }) => t.ticker === "DEMO");
  expect(trade.aiComment.text).toContain("disabled");
  await a.evaluate(() => window.scrollTo(0, 0));
  await a.screenshot({ path: "test-results/logged-trade.png", fullPage: true });
  a.once("dialog", (dialog) => dialog.accept("110"));
  await a
    .getByTestId("position-DEMO")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(a.getByTestId("ledger")).toContainText(
    "Ledger realized: $150.00",
  );
  await a.evaluate(() => window.scrollTo(0, 0));
  await a.screenshot({
    path: "test-results/closed-trade-ledger.png",
    fullPage: true,
  });
  const denied = await a.request.get("/api/trades/synthetic-b-open");
  expect(denied.status()).toBe(404);
  await a.goto("/api/trades/synthetic-b-open");
  await a.evaluate(() => window.scrollTo(0, 0));
  await a.screenshot({ path: "test-results/denied-cross-user.png" });
  await a.request.delete("/api/trades/" + trade.id, { headers: origin });
  await ca.close();
  await cb.close();
});

test("HTTP ownership covers comments, assets, exports, validation, and anonymous access", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  await login(a, "synthetic-a");
  await login(b, "synthetic-b");
  const assetList = await (await a.request.get("/api/assets")).json();
  expect(
    assetList.every((t: { userId: string }) => t.userId === "synthetic-a"),
  ).toBe(true);
  for (const path of [
    "/api/trades/synthetic-b-open/comments",
    "/api/assets/synthetic-b-asset",
  ]) {
    expect((await a.request.get(path)).status()).toBe(404);
    expect(
      (
        await a.request.patch(path, {
          headers: origin,
          data: path.includes("comments")
            ? { text: "attack" }
            : { name: "attack", category: "Cash", value: "1" },
        })
      ).status(),
    ).toBe(404);
    expect((await a.request.delete(path, { headers: origin })).status()).toBe(
      404,
    );
  }
  for (const path of [
    "/api/trades/export?id=synthetic-b-open",
    "/api/assets/export?id=synthetic-b-asset",
  ])
    expect((await a.request.get(path)).status()).toBe(404);
  const exportText = await (await a.request.get("/api/trades/export")).text();
  expect(exportText).not.toContain("synthetic-b");
  expect(
    (
      await a.request.post("/api/trades", {
        headers: origin,
        data: {
          ticker: "BAD",
          type: "STOCK",
          side: "BUY",
          quantity: -1,
          entryPrice: 10,
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await a.request.post("/api/trades", {
        headers: { Origin: "https://evil.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await a.request.post("/api/analyze", {
        headers: origin,
        data: { summary: "synthetic" },
      })
    ).status(),
  ).toBe(200);
  const anon = await browser.newContext();
  expect(
    (await anon.request.get("http://127.0.0.1:3000/api/trades")).status(),
  ).toBe(401);
  await anon.close();
  await ca.close();
  await cb.close();
});
test("read-only demo and CSV preview in React", async ({ page }) => {
  await login(page, "synthetic-demo");
  expect(
    (
      await page.request.post("/api/trades", {
        headers: origin,
        data: {
          ticker: "NO",
          type: "STOCK",
          side: "BUY",
          quantity: 1,
          entryPrice: 1,
        },
      })
    ).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "synthetic-a");
  await page.goto("/import");
  await page
    .getByLabel("CSV data")
    .fill("ticker,type,side,quantity,entryPrice\nBAD,STOCK,BUY,-1,100");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText(/Row 2: quantity/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import valid rows" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/csv-validation.png",
    fullPage: true,
  });
});
