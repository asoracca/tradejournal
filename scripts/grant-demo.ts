import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DIRECT_URL!);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/tradegoons_test"
)
  throw Error("Only the disposable local database is allowed");
const db = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});
async function main() {
  await db.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO tradegoons_app");
  await db.$executeRawUnsafe(
    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tradegoons_app",
  );
  await db.$executeRawUnsafe(
    "REVOKE ALL ON SCHEMA legacy_unowned FROM tradegoons_app",
  );
}
main().finally(() => db.$disconnect());
