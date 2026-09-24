FROM eclipse-temurin:21-jdk-jammy AS java-build
WORKDIR /build
COPY backend/pom.xml backend/mvnw ./
COPY backend/.mvn ./.mvn
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline
COPY backend/src ./src
RUN ./mvnw -B -ntp package -DskipTests

FROM node:22-bookworm-slim AS web-build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM eclipse-temurin:21-jre-jammy AS jre
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=jre /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk PATH="/opt/java/openjdk/bin:${PATH}" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=java-build --chown=node:node /build/target/trade-api-1.0.0.jar ./trade-api.jar
COPY --from=web-build --chown=node:node /app/.next/standalone ./
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static
COPY --from=web-build --chown=node:node /app/public ./public
COPY --chown=node:node scripts/start-hosted.mjs ./start-hosted.mjs
USER node
EXPOSE 10000
CMD ["node", "start-hosted.mjs"]
