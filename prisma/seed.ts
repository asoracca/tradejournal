import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { hashPassword } from "../lib/password";
const url = new URL(process.env.DATABASE_URL!);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/tradegoons_test"
)
  throw Error("Seed/reset only allowed on local tradegoons_test");
const db = new PrismaClient();
async function main() {
  mkdirSync(".local", { recursive: true });
  const file = ".local/demo-accounts.json";
  const accounts: {
    id: string;
    email: string;
    password: string;
    readOnly: boolean;
  }[] = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : ["a", "b", "demo"].map((id) => ({
        id: "synthetic-" + id,
        email: id + "@example.test",
        password: randomBytes(18).toString("base64url"),
        readOnly: id === "demo",
      }));
  for (const a of accounts) {
    await db.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          email: a.email,
          passwordHash: hashPassword(a.password),
          readOnly: a.readOnly,
        },
        update: {
          passwordHash: hashPassword(a.password),
          readOnly: a.readOnly,
        },
      });
      await tx.trade.deleteMany({ where: { userId: a.id } });
      await tx.asset.deleteMany({ where: { userId: a.id } });
      await tx.trade.create({
        data: {
          id: a.id + "-open",
          userId: a.id,
          ticker: "SYNTH",
          type: "STOCK",
          side: "BUY",
          quantity: "10",
          entryPrice: "100",
          tradeDate: new Date("2026-01-05T00:00:00Z"),
          createdAt: new Date("2026-01-05T00:00:00Z"),
          notes: "Synthetic fixture; not real holdings",
          aiComment: {
            create: {
              user: { connect: { id: a.id } },
              text: "AI disabled. Synthetic example.",
            },
          },
        },
      });
      await tx.trade.create({
        data: {
          id: a.id + "-closed",
          userId: a.id,
          ticker: "SYNTH",
          type: "STOCK",
          side: "SELL",
          quantity: "5",
          entryPrice: "120",
          exitPrice: "110",
          status: "CLOSED",
          closedAt: new Date("2026-01-06T00:00:00Z"),
          createdAt: new Date("2026-01-05T00:00:00Z"),
        },
      });
      await tx.asset.create({
        data: {
          id: a.id + "-asset",
          userId: a.id,
          name: "Synthetic cash example",
          category: "Cash",
          value: "1000",
        },
      });
    });
  }
  writeFileSync(file, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  console.log(
    "Seed v1: 3 synthetic accounts, 6 trades, 3 assets. Credentials: .local/demo-accounts.json. Expected realized $50.00; synthetic unrealized $100.00 per account.",
  );
}
main().finally(() => db.$disconnect());
