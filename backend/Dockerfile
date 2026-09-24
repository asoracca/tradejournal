# Build context: repository root. Java stays private behind the Next.js boundary.
FROM eclipse-temurin:21-jdk-jammy AS build
RUN apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY backend/pom.xml backend/mvnw ./
COPY backend/.mvn ./.mvn
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline
COPY backend/src ./src
RUN ./mvnw -B -ntp package -DskipTests

FROM eclipse-temurin:21-jre-jammy
RUN groupadd --gid 10001 tradegoons && useradd --uid 10001 --gid tradegoons --no-create-home tradegoons
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/target/trade-api-1.0.0.jar /app/trade-api.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65", "-jar", "/app/trade-api.jar"]
