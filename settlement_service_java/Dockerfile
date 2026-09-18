# --- Stage 1: Build compilation boundary ---
FROM maven:3.9.6-eclipse-temurin-21-jammy AS builder
WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests

# --- Stage 2: Hardened Runtime Execution Boundary ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

RUN useradd -ms /bin/bash appuser
USER appuser

COPY --from=builder /app/target/settlement-service-1.0.0.jar app.jar

EXPOSE 8002

ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:+UseContainerSupport", "-jar", "app.jar"]
