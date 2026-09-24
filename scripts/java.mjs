import nextEnv from "@next/env";
import { spawn } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd());
const action = process.argv[2] || "run";
const source =
  action === "migrate" ? process.env.DIRECT_URL : process.env.DATABASE_URL;
if (!source) throw Error("Configure DATABASE_URL / DIRECT_URL first");
const url = new URL(source);
const env = {
  ...process.env,
  JDBC_DATABASE_URL: `jdbc:postgresql://${url.host}${url.pathname}`,
  JDBC_DATABASE_USER: decodeURIComponent(url.username),
  JDBC_DATABASE_PASSWORD: decodeURIComponent(url.password),
};
if (url.searchParams.has("sslmode"))
  env.JDBC_DATABASE_URL += "?sslmode=" + url.searchParams.get("sslmode");
// The HTTP application never receives the migration connection string.
delete env.DIRECT_URL;
if (action === "migrate") env.TRADE_MIGRATE = "true";
if (!env.TRADE_SERVICE_SECRET || env.TRADE_SERVICE_SECRET.length < 32)
  throw Error("Set TRADE_SERVICE_SECRET (32+ random characters) in .env");
const mvn = process.env.MAVEN_COMMAND || "./backend/mvnw";
const commands = {
  build: [
    mvn,
    ["-f", "backend/pom.xml", "-B", "-ntp", "package", "-DskipTests"],
  ],
  test: [mvn, ["-f", "backend/pom.xml", "-B", "-ntp", "verify"]],
  run: ["java", ["-jar", "backend/target/trade-api-1.0.0.jar"]],
  migrate: ["java", ["-jar", "backend/target/trade-api-1.0.0.jar"]],
};
if (!commands[action]) throw Error("Use build, test, migrate, or run");
const [command, args] = commands[action];
const child = spawn(command, args, { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on("exit", (code) => process.exit(code ?? 1));
