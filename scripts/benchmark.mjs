import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { cpus, totalmem, platform, release, arch } from "node:os";
import { performance } from "node:perf_hooks";
nextEnv.loadEnvConfig(process.cwd());
const database = new URL(process.env.DATABASE_URL);
const api = new URL(process.env.TRADE_API_URL || "http://127.0.0.1:8080");
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname != "/tradegoons_test" ||
  !["localhost", "127.0.0.1"].includes(api.hostname)
)
  throw Error("Benchmark only against the disposable local stack");
const secret = process.env.TRADE_SERVICE_SECRET;
if (!secret || secret.length < 32)
  throw Error("Configure TRADE_SERVICE_SECRET");
const out = process.argv[2] || "docs/benchmarks/latest";
mkdirSync(out, { recursive: true });
const raw = out + "/requests.jsonl";
writeFileSync(raw, "");
const db = new PrismaClient();
const user = "benchmark-synthetic";
const cycles = 200,
  warmup = 20,
  baseRows = 1000;
const metadata = {
  startedAt: new Date().toISOString(),
  os: platform(),
  osRelease: release(),
  architecture: arch(),
  cpu: cpus()[0].model,
  logicalCpus: cpus().length,
  memoryBytes: totalmem(),
  node: process.version,
  springBoot: "4.1.1",
  dataset: {
    version: 1,
    seed: "fixed-synth-1000-v1",
    baseRows,
    open: 500,
    closed: 500,
    quantity: "1",
    entry: "100",
    exitOrMark: "110",
  },
  workload: {
    cyclesPerRun: cycles,
    requestsPerCycle: 7,
    warmupCyclesPerRun: warmup,
    concurrency: [1, 8],
    repeats: 3,
    operations: [
      "create",
      "edit",
      "read-open",
      "close",
      "read-closed",
      "portfolio",
      "delete",
    ],
    marks: "synthetic-fixed",
    client: "Node fetch keep-alive, one sequential lifecycle per worker",
    timing:
      "client monotonic wall clock through HTTP JSON parsing; excludes warmup",
    scope:
      "direct signed Java REST API, local PostgreSQL; excludes Next.js, browser, Gemini, external quotes, TLS, WAN",
  },
  jvmFlags: "defaults; no profiler/JaCoCo agent on benchmark server",
  poolSize: 8,
};
// java -version is written to stderr; capture both without shell expansion.
const { spawnSync } = await import("node:child_process");
const version = spawnSync("java", ["-version"], { encoding: "utf8" });
metadata.java = (version.stdout + version.stderr).trim();
const sourceFiles = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .stdout.trim()
  .split("\n")
  .filter((p) => existsSync(p))
  .filter((p) =>
    /^(app\/|lib\/|backend\/src\/|backend\/pom.xml$|scripts\/|package(-lock)?\.json$)/.test(
      p,
    ),
  )
  .sort();
const manifest = Object.fromEntries(
  sourceFiles.map((file) => [
    file,
    createHash("sha256").update(readFileSync(file)).digest("hex"),
  ]),
);
metadata.sourceManifest = "source-manifest.json";
metadata.sourceSha256 = createHash("sha256")
  .update(JSON.stringify(manifest))
  .digest("hex");
metadata.baseCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).stdout.trim();
metadata.workingTree =
  "uncommitted Java slice; source manifest records the measured files";
writeFileSync(out + "/source-manifest.json", JSON.stringify(manifest, null, 2));
const results = [];
async function request(op, method, path, value, expected, run, warming) {
  const body = value === undefined ? "" : JSON.stringify(value),
    time = String(Math.floor(Date.now() / 1000)),
    nonce = randomUUID();
  const hash = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update([method, path, user, time, nonce, hash].join("\n"))
    .digest("hex");
  const start = performance.now();
  let status = 0,
    data,
    error;
  try {
    const res = await fetch(api.origin + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Trade-User": user,
        "X-Trade-Time": time,
        "X-Trade-Nonce": nonce,
        "X-Trade-Signature": signature,
      },
      body: body || undefined,
      signal: AbortSignal.timeout(10000),
    });
    status = res.status;
    data = await res.json();
    if (status !== expected) error = data?.code || "unexpected_status";
    if (op === "close" && data.realizedPnl !== "125.06")
      error = "incorrect_pnl";
    if (op === "read-closed" && data.status !== "CLOSED")
      error = "incorrect_state";
  } catch (e) {
    error = e.name;
  }
  const row = {
    run,
    op,
    status,
    expected,
    latencyMs: performance.now() - start,
    ok: !error,
    ...(error ? { error } : {}),
    warmup: warming,
  };
  appendFileSync(raw, JSON.stringify(row) + "\n");
  if (!warming) results.push(row);
  if (error) throw Error(op + ": " + error);
  return data;
}
async function lifecycle(run, warming) {
  const t = await request(
    "create",
    "POST",
    "/v1/trades",
    {
      ticker: "SYNTH",
      type: "STOCK",
      side: "BUY",
      quantity: "10",
      entryPrice: "100",
    },
    201,
    run,
    warming,
  );
  const path = "/v1/trades/" + t.id;
  await request(
    "edit",
    "PATCH",
    path,
    { quantity: "12.5", notes: "Synthetic benchmark" },
    200,
    run,
    warming,
  );
  await request("read-open", "GET", path, undefined, 200, run, warming);
  await request(
    "close",
    "POST",
    path + "/close",
    { exitPrice: "110.005" },
    200,
    run,
    warming,
  );
  await request("read-closed", "GET", path, undefined, 200, run, warming);
  await request(
    "portfolio",
    "POST",
    "/v1/portfolio",
    { mode: "PAPER", marks: { SYNTH: { price: "110", previousClose: "108" } } },
    200,
    run,
    warming,
  );
  await request("delete", "DELETE", path, undefined, 200, run, warming);
}
async function workers(count, concurrency, run, warming) {
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next++ < count) await lifecycle(run, warming);
    }),
  );
}
function stats(rows) {
  const values = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
  const percentile = (p) =>
    values[Math.max(0, Math.ceil(p * values.length) - 1)];
  return {
    requests: rows.length,
    errors: rows.filter((r) => !r.ok).length,
    errorRate: rows.filter((r) => !r.ok).length / rows.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: values.at(-1),
  };
}
const runs = [];
try {
  const prior = await db.user.findUnique({ where: { id: user } });
  if (prior && prior.email !== "benchmark@example.test")
    throw Error("Reserved fixture identity already occupied");
  await db.user.upsert({
    where: { id: user },
    create: {
      id: user,
      email: "benchmark@example.test",
      passwordHash: "no-browser-login",
    },
    update: {},
  });
  await db.trade.deleteMany({ where: { userId: user } });
  await db.trade.createMany({
    data: Array.from({ length: baseRows }, (_, i) => ({
      id: `benchmark-seed-${i}`,
      userId: user,
      ticker: "SYNTH",
      type: "STOCK",
      side: "BUY",
      quantity: "1",
      entryPrice: "100",
      createdAt: new Date("2026-01-05T00:00:00Z"),
      ...(i < 500
        ? {
            status: "CLOSED",
            exitPrice: "110",
            closedAt: new Date("2026-01-06T00:00:00Z"),
          }
        : {}),
    })),
  });
  metadata.postgres = (
    await db.$queryRawUnsafe("SELECT version() AS version")
  )[0].version;
  writeFileSync(out + "/metadata.json", JSON.stringify(metadata, null, 2));
  for (const concurrency of [1, 8])
    for (let repetition = 1; repetition <= 3; repetition++) {
      const run = `c${concurrency}-r${repetition}`;
      await workers(warmup, concurrency, run, true);
      const started = performance.now();
      await workers(cycles, concurrency, run, false);
      const seconds = (performance.now() - started) / 1000;
      const rows = results.filter((r) => r.run === run);
      runs.push({
        run,
        concurrency,
        repetition,
        seconds,
        requestsPerSecond: rows.length / seconds,
        ...stats(rows),
        operations: Object.fromEntries(
          metadata.workload.operations.map((op) => [
            op,
            stats(rows.filter((r) => r.op === op)),
          ]),
        ),
      });
      console.log(run, JSON.stringify(runs.at(-1)));
    }
  writeFileSync(
    out + "/summary.json",
    JSON.stringify(
      { metadata: "metadata.json", raw: "requests.jsonl", runs },
      null,
      2,
    ),
  );
} finally {
  await db.trade.deleteMany({ where: { userId: user } });
  await db.user.deleteMany({ where: { id: user } });
  await db.$disconnect();
}
