import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const url = new URL(process.env.DIRECT_URL!);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname != "/tradegoons_test"
)
  throw Error("Local disposable database required");
const admin = new PrismaClient({
  datasources: { db: { url: url.toString() } },
});
const name = "tradegoons_rehearsal_" + randomBytes(6).toString("hex");
async function main() {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  url.pathname = "/" + name;
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    async function migration(name: string) {
      for (const sql of readFileSync(
        `prisma/migrations/${name}/migration.sql`,
        "utf8",
      )
        .split(";")
        .filter((s) => s.trim()))
        await db.$executeRawUnsafe(sql);
    }
    await migration("202609220001_baseline");
    await db.$executeRaw`INSERT INTO "Trade" (id,ticker,type,side,quantity,"entryPrice") VALUES ('legacy','SYNTH','STOCK','BUY',1,0.30000000000000004)`;
    await db.$executeRaw`INSERT INTO "AiComment" (id,text,"tradeId") VALUES ('legacy-comment','Preserved original','legacy')`;
    await migration("202609220002_ownership");
    await migration("202609220003_auth_limits");
    await db.user.create({
      data: {
        id: "new-synthetic",
        email: "new@example.test",
        passwordHash: "test-only-disabled",
        disabled: true,
      },
    });
    const active = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM public."Trade"`;
    assert.equal(active[0].count, 0n);
    const saved = await db.$queryRaw<
      { entryPrice: number }[]
    >`SELECT "entryPrice" FROM legacy_unowned."Trade" WHERE id='legacy'`;
    assert.equal(saved[0].entryPrice, 0.30000000000000004);
    const comments = await db.$queryRaw<
      { text: string }[]
    >`SELECT text FROM legacy_unowned."AiComment"`;
    assert.equal(comments[0].text, "Preserved original");
    await db.$executeRawUnsafe("CREATE SCHEMA multi_user_hold");
    for (const table of [
      "AiComment",
      "Trade",
      "Asset",
      "CongressTrade",
      "User",
      "LoginAttempt",
    ])
      await db.$executeRawUnsafe(
        `ALTER TABLE public."${table}" SET SCHEMA multi_user_hold`,
      );
    for (const table of ["Trade", "AiComment", "Asset", "CongressTrade"])
      await db.$executeRawUnsafe(
        `ALTER TABLE legacy_unowned."${table}" SET SCHEMA public`,
      );
    const restored = await db.$queryRaw<
      { entryPrice: number }[]
    >`SELECT "entryPrice" FROM public."Trade" WHERE id='legacy'`;
    assert.equal(restored[0].entryPrice, 0.30000000000000004);
    const held = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM multi_user_hold."User" WHERE id='new-synthetic'`;
    assert.equal(held[0].count, 1n);
    console.log(
      "PASS: original float and nested comment preserved; active tables empty; maintenance rollback restores original float. Separate temporary database only.",
    );
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
  }
}
main().finally(() => admin.$disconnect());
