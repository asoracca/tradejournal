import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const url = new URL(process.env.DATABASE_URL || "");
if (!process.env.NEXTAUTH_SECRET || !process.env.NEXTAUTH_URL)
  throw Error("Configure the session secret and public application URL.");
if (process.env.DIRECT_URL || process.env.TRADE_MIGRATE === "true")
  throw Error("Migration credentials and startup migrations are not permitted here.");
const shared = process.env.TRADE_SERVICE_SECRET || randomBytes(32).toString("hex");
const env = { ...process.env, TRADE_SERVICE_SECRET: shared };
const ssl = url.searchParams.get("sslmode");
const javaEnv = {
  ...env,
  TRADE_API_BIND: "127.0.0.1",
  TRADE_API_PORT: "8080",
  JDBC_DATABASE_URL: `jdbc:postgresql://${url.host}${url.pathname}${ssl ? "?sslmode=" + ssl : ""}`,
  JDBC_DATABASE_USER: decodeURIComponent(url.username),
  JDBC_DATABASE_PASSWORD: decodeURIComponent(url.password),
  SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: "2",
};
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 10000);
  timer.unref();
  Promise.all(children.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(resolve => child.once("exit", resolve))))
    .then(() => process.exit(code));
}
function launch(command, args, childEnv) {
  const child = spawn(command, args, { env: childEnv, stdio: "inherit" });
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", code => { if (!stopping) stop(code || 1); });
  return child;
}
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
launch("java", ["-Xmx160m", "-XX:MaxMetaspaceSize=128m", "-XX:ReservedCodeCacheSize=32m", "-Xss512k", "-XX:ActiveProcessorCount=2", "-jar", "trade-api.jar"], javaEnv);
let ready = false;
for (let i = 0; i < 90 && !stopping; i++) {
  try { ready = (await fetch("http://127.0.0.1:8080/health", { signal: AbortSignal.timeout(1000) })).ok; } catch {}
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) stop(1);
else launch(process.execPath, ["--max-old-space-size=128", "server.js"], {
  ...env, HOSTNAME: "0.0.0.0", PORT: process.env.PORT || "10000", TRADE_API_URL: "http://127.0.0.1:8080",
});
