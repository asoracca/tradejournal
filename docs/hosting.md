# Free demo hosting

The root Dockerfile runs Next.js and Spring Boot in one container. Only Next.js listens on Render's public PORT (default 10000); Java remains on 127.0.0.1:8080. This avoids exposing the internal API or requiring a paid private service. PostgreSQL remains external on the existing isolated Neon Free demo database. Gemini stays disabled unless explicitly configured.

```sh
docker build -t tradegoons-demo .
```

On Render, choose **Web Service → Public Git Repository**, this repository's `feat/java-trade-lifecycle` branch, language **Docker**, root `Dockerfile`, and instance **Free ($0/month)**. Do not use the default paid instance. No GitHub permission grant is needed for this public repository. Keep no payment method on the free workspace: Render suspends services/builds on allowance exhaustion instead of billing overages. Free service hours are shared across the workspace, including other projects; do not use keep-awake requests to evade idle suspension. See [Render's limits](https://render.com/docs/free).

Supply only the isolated demo database's **limited-role DATABASE_URL**, a persistent **NEXTAUTH_SECRET**, and the public **NEXTAUTH_URL**. Set **MARKET_DATA_MODE=synthetic** and leave **GEMINI_API_KEY** empty. DATABASE_URL should use verified TLS and a small Prisma connection_limit (2). No administrator connection, DIRECT_URL or startup migration is accepted. The launcher creates an ephemeral internal HMAC key shared by its two child processes; it never reaches the browser.

The allowlisted Docker context excludes local configuration, credentials, database files and build outputs. The runtime runs as an unprivileged node user. The launcher starts Java, waits for liveness, then starts Next.js; if either process exits it shuts down the other. It forwards termination signals. Java's heap is capped at 160 MiB, metaspace 128 MiB, code cache 32 MiB, JDBC pool 2; Node's old-generation heap is capped at 128 MiB. These are individual limits, not proof total RSS fits 512 MiB under arbitrary load. Observe actual hosted memory and test the deployment before calling it ready. No scaling or production-capacity claim is made.

The memory-limited launcher and standalone production build passed the four local Playwright scenarios. GitHub's separate container job builds the actual Linux image without credentials. Initial downloads require internet. Cold starts, monthly free limits and provider outages may make the demo unavailable. Do not use Render's expiring free PostgreSQL database as a replacement for the existing Neon demo database without a separate migration decision.

The image never migrates or seeds on startup. Before cutover, verify the isolated schema and apply required migrations explicitly through an authorized migration environment. Test create, edit, retrieve, close, persistence, denied cross-user requests and read-only demo enforcement with temporary synthetic accounts, then remove those temporary accounts. Preserve the existing public site until those checks pass. The separate `backend/Dockerfile` is for a future private-network Java-only deployment, not the free combined service.

Hosted Java connections require `verify-full` with the JVM trust store (`DefaultJavaSSLFactory`), checking both the certificate chain and hostname. A read-only JDBC identity probe against the isolated Neon database passed using the limited role. See [pgJDBC TLS behavior](https://jdbc.postgresql.org/documentation/ssl/).
