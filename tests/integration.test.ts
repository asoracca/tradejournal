import { beforeAll, afterAll, it, expect } from "vitest";
import { prisma } from "../lib/db";
import {
  createTrade,
  listTrades,
  readTrade,
  updateTrade,
  deleteTrade,
} from "../lib/trades";
const a = "synthetic-a",
  b = "synthetic-b";
beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname != "/tradegoons_test"
  )
    throw Error("Disposable database required");
});
afterAll(() => prisma.$disconnect());
it("uses a non-owner, non-superuser application role", async () => {
  const rows = await prisma.$queryRaw<
    { rolsuper: boolean; rolbypassrls: boolean }[]
  >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  await expect(
    prisma.$queryRawUnsafe('SELECT * FROM legacy_unowned."Trade"'),
  ).rejects.toThrow();
});
it("A cannot list, read, update or delete B, including nested comments", async () => {
  expect(
    (await listTrades(a)).every(
      (t) => t.userId === a && (!t.aiComment || t.aiComment.userId === a),
    ),
  ).toBe(true);
  await expect(readTrade(a, b + "-open")).rejects.toThrow();
  await expect(
    updateTrade(a, b + "-open", { notes: "attack" }),
  ).rejects.toThrow();
  await expect(deleteTrade(a, b + "-open")).rejects.toThrow();
  expect((await readTrade(b, b + "-open")).notes).toContain("Synthetic");
});
it("database rejects cross-owner comments and invalid quantities", async () => {
  await expect(
    prisma.aiComment.create({
      data: { userId: a, tradeId: b + "-closed", text: "attack" },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.trade.create({
      data: {
        userId: a,
        ticker: "INVALID",
        type: "STOCK",
        side: "BUY",
        quantity: -1,
        entryPrice: 100,
      },
    }),
  ).rejects.toThrow();
});
it("close is atomic and repeatable; conflicting closes and closed edits fail", async () => {
  const t = await createTrade(a, {
    ticker: "TEST",
    type: "STOCK",
    side: "BUY",
    quantity: "10",
    entryPrice: "100",
  });
  const results = await Promise.all([
    updateTrade(a, t.id, { status: "CLOSED", exitPrice: "110" }),
    updateTrade(a, t.id, { status: "CLOSED", exitPrice: "110" }),
  ]);
  expect(results[0].closedAt).toEqual(results[1].closedAt);
  await expect(
    updateTrade(a, t.id, { status: "CLOSED", exitPrice: "111" }),
  ).rejects.toThrow();
  await expect(updateTrade(a, t.id, { entryPrice: "50" })).rejects.toThrow();
  await deleteTrade(a, t.id);
});

import { importCsv, exportCsv } from "../lib/csv";
import { ledger } from "../lib/ledger";
it("CSV retries and concurrent imports are idempotent and tenant scoped", async () => {
  const csv =
    "ticker,type,side,quantity,entryPrice,notes\nCSVTEST,STOCK,BUY,2,100,=SUM(A1:A2)";
  await prisma.trade.deleteMany({
    where: { ticker: "CSVTEST", userId: { in: [a, b] } },
  });
  const preview = await importCsv(a, csv, false);
  expect(preview.rows[0].errors).toEqual([]);
  expect(
    await prisma.trade.count({ where: { ticker: "CSVTEST", userId: a } }),
  ).toBe(0);
  const results = await Promise.all([
    importCsv(a, csv, true),
    importCsv(a, csv, true),
  ]);
  expect(results.reduce((s, r) => s + r.imported, 0)).toBe(1);
  expect((await importCsv(b, csv, true)).imported).toBe(1);
  expect(await exportCsv(a)).toContain("'=SUM");
  await expect(exportCsv(a, b + "-open")).rejects.toThrow();
  await prisma.trade.deleteMany({
    where: { ticker: "CSVTEST", userId: { in: [a, b] } },
  });
});
it("SQL ledger matches independently calculated seed values", async () => {
  const result = await ledger("synthetic-demo");
  expect(Number(result.realized)).toBe(50);
  expect(Number(result.unrealized)).toBe(100);
  expect(result.complete).toBe(true);
});

it("aggregate user parameters cannot inject SQL", async () => {
  const result = await ledger("synthetic-demo' OR true --");
  expect(Number(result.realized)).toBe(0);
  expect(Number(result.unrealized)).toBe(0);
});

it("options sharing a stock ticker stay unpriced without a contract mark", async () => {
  const trade = await createTrade("synthetic-a", {ticker:"SYNTH",type:"OPTION",side:"BUY",quantity:"1",entryPrice:"2",optionType:"CALL",strike:"110",expiration:"2026-12-18"});
  try { const result=await ledger("synthetic-a"); expect(result.unpriced).toBe(1); expect(result.complete).toBe(false); expect(Number(result.unrealized)).toBe(100); } finally { await deleteTrade("synthetic-a",trade.id); }
});
