# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for all Java Spring Boot services
# Stage 1: Build with Maven
# Stage 2: Run with lean JRE image
# ─────────────────────────────────────────────────────────────────────────────

# ── Build stage ──────────────────────────────────────────────────────────────
FROM maven:3.9.5-eclipse-temurin-21 AS build

WORKDIR /app

# Copy parent pom first (better layer caching)
COPY ../../pom.xml ./parent-pom.xml

# Copy service pom and download dependencies (cached unless pom.xml changes)
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copy source and build
COPY src ./src
RUN mvn package -DskipTests -q

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# Security: run as non-root
RUN groupadd -r fintrack && useradd -r -g fintrack fintrack

# Copy jar from build stage
COPY --from=build /app/target/*.jar app.jar

# Health check script
RUN apt-get update -q && apt-get install -y -q curl && rm -rf /var/lib/apt/lists/*

USER fintrack

EXPOSE 8080

# JVM tuning: container-aware heap sizing
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+UseG1GC", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "/app/app.jar"]
