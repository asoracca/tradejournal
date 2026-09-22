import EmbeddedPostgres from "embedded-postgres";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
mkdirSync(".local", { recursive: true });
const path = ".local/database.json";
const config = existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : {
      admin: randomBytes(24).toString("hex"),
      app: randomBytes(24).toString("hex"),
      secret: randomBytes(32).toString("hex"),
    };
writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
const pg = new EmbeddedPostgres({
  databaseDir: ".local/postgres",
  user: "postgres",
  password: config.admin,
  port: 55432,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(".local/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_roles WHERE rolname='tradegoons_app'"))
    .rowCount
) {
  await client.query(
    `CREATE ROLE tradegoons_app LOGIN PASSWORD '${config.app}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
  );
  await client.query("CREATE DATABASE tradegoons_test");
}
await client.end();
const direct = `postgresql://postgres:${config.admin}@127.0.0.1:55432/tradegoons_test?schema=public`;
const db = `postgresql://tradegoons_app:${config.app}@127.0.0.1:55432/tradegoons_test?schema=public`;
writeFileSync(
  ".env",
  `DATABASE_URL="${db}"
DIRECT_URL="${direct}"
NEXTAUTH_URL="http://127.0.0.1:3000"
NEXTAUTH_SECRET="${config.secret}"
MARKET_DATA_MODE="synthetic"
GEMINI_API_KEY=""
`,
  { mode: 0o600 },
);
console.log(
  "Disposable PostgreSQL listening on 127.0.0.1:55432. Local .env written. Keep this process running.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
