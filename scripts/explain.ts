import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { aggregateQuery } from "../lib/ledger";
async function main() {
  const version = await prisma.$queryRaw`SELECT version(), current_user`;
  const count = await prisma.trade.count();
  const plan = await prisma.$queryRaw(
    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${aggregateQuery("synthetic-demo", "PAPER", null, JSON.stringify({ SYNTH: "110" }))}`,
  );
  console.log(
    JSON.stringify(
      {
        seed: "v1",
        rows: count,
        version,
        inputs: {
          userId: "synthetic-demo",
          mode: "PAPER",
          marks: { SYNTH: "110" },
        },
        plan,
      },
      null,
      2,
    ),
  );
}
main().finally(() => prisma.$disconnect());
