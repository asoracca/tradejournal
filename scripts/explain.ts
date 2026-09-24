import { loadEnvConfig } from "@next/env";
import { prisma } from "../lib/db";
loadEnvConfig(process.cwd());
async function main() {
  const info =
    await prisma.$queryRaw`SELECT version(), current_user, (SELECT count(*)::int FROM public."Trade") AS rows`;
  const plan =
    await prisma.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM public."Trade" WHERE "userId"=${"synthetic-demo"} AND mode=${"PAPER"} AND (CAST(${null} AS text) IS NULL OR account=${null})`;
  console.log(
    JSON.stringify(
      { fixture: "seed-v1", user: "synthetic-demo", mode: "PAPER", info, plan },
      null,
      2,
    ),
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
