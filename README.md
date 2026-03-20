# FinTrack Pro
## Transaction Monitoring & Regulatory Intelligence Platform

Full-stack Java + Angular project — local Docker Compose + AWS EKS deployment.

---

## What this project includes

| Layer | Technology | Port |
|---|---|---|
| Angular 15 SPA | NgRx · RxJS · CDK Virtual Scroll | 4200 |
| Transaction Service | Java 19 · Spring Boot 3 · H2/SQL Server | 8081 |
| AI Query Service | Spring WebFlux · OpenAI SSE streaming | 8082 |
| WebSocket Relay | Spring WebSocket · STOMP · SockJS | 8083 |
| Report Service | Async job generation · CSV/Text export | 8084 |
| Kafka | Event bus (transaction/compliance/audit topics) | 9092 |
| Redis | Session cache · idempotency · rate limiting | 6379 |
| Kafka UI | Topic browser for local dev | 8090 |
| Prometheus | Metrics scraping | 9090 |
| Grafana | Dashboards (admin/fintrack123) | 3000 |

---

## Quick start — Local (Docker Compose)

### Prerequisites
- Docker Desktop 4.x+
- Node.js 20+
- Java 21+ (for running services outside Docker)
- Maven 3.9+

### Step 1 — Clone and set up environment
```bash
git clone <your-repo-url> fintrack-pro
cd fintrack-pro

# Copy environment template
cp .env.example .env

# Edit .env — add your OpenAI API key (optional, app works without it)
# OPENAI_API_KEY=sk-your-key-here
```

### Step 2 — Start infrastructure (Kafka + Redis + Observability)
```bash
cd infra/docker
docker-compose up -d zookeeper kafka redis kafka-ui prometheus grafana

# Wait for Kafka to be healthy (about 30 seconds)
docker-compose ps
```

### Step 3 — Run Java backend services
**Option A — Run all with Docker Compose (simplest)**
```bash
# From infra/docker/
docker-compose up -d

# Watch logs
docker-compose logs -f transaction-service
```

**Option B — Run each service manually (easier for development)**
```bash
# Terminal 1 — Transaction Service
cd backend/transaction-service
mvn spring-boot:run

# Terminal 2 — AI Query Service
cd backend/ai-query-service
mvn spring-boot:run -DOPENAI_API_KEY=your-key-here

# Terminal 3 — WebSocket Relay
cd backend/websocket-relay
mvn spring-boot:run

# Terminal 4 — Report Service
cd backend/report-service
mvn spring-boot:run
```

### Step 4 — Start Angular frontend
```bash
cd frontend
npm install
npm start
# Opens at http://localhost:4200
```

### Step 5 — Open and explore
| URL | What it is |
|---|---|
| http://localhost:4200 | Angular dashboard |
| http://localhost:8081/swagger-ui.html | Transaction Service API docs |
| http://localhost:8081/h2-console | H2 in-memory database viewer |
| http://localhost:8090 | Kafka UI — browse topics and messages |
| http://localhost:3000 | Grafana (admin / fintrack123) |

### Step 6 — Seed test transactions
```bash
# Run the seed script to populate test data
cd scripts
chmod +x seed-transactions.sh
./seed-transactions.sh
```

---

## Create your first transaction (API test)

```bash
curl -X POST http://localhost:8081/api/transactions \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "accountId": "ACC-001",
    "counterpartyId": "CORP-XYZ",
    "amount": 15000.00,
    "currency": "USD"
  }'
```

This transaction is above the $10,000 AML threshold — it will be flagged immediately and a compliance event published to Kafka. Watch the Kafka UI to see the `transaction-events` and `compliance-events` topics receive messages.

---

## Project structure

```
fintrack-pro/
├── backend/
│   ├── pom.xml                         # Maven multi-module parent
│   ├── transaction-service/            # Core ingestion + rule engine
│   │   └── src/main/java/com/fintrack/transaction/
│   │       ├── controller/             # REST API
│   │       ├── service/                # Business logic + RuleEngine
│   │       ├── kafka/                  # Kafka producer
│   │       ├── repository/             # JPA queries
│   │       ├── model/                  # Transaction entity + enums
│   │       └── config/                 # Security, Kafka config
│   ├── ai-query-service/               # RAG pipeline + OpenAI SSE
│   ├── websocket-relay/                # Kafka → STOMP WebSocket bridge
│   ├── compliance-service/             # CTR/SAR event publishing
│   └── report-service/                 # Async CSV/Text report generation
│
├── frontend/
│   └── src/app/
│       ├── core/
│       │   ├── store/                  # NgRx state, actions, reducers
│       │   ├── api/                    # HTTP services
│       │   └── websocket/              # STOMP WebSocket service
│       └── features/
│           ├── dashboard/              # KPI tiles + flagged tx list
│           ├── transactions/           # Virtual-scroll live stream + detail
│           ├── ai-query/               # SSE streaming AI interface
│           └── reports/                # Compliance report builder
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml          # Full local stack
│   │   ├── Dockerfile.java             # Multi-stage Java build
│   │   └── prometheus.yml              # Scrape targets
│   ├── k8s/
│   │   └── base/
│   │       ├── configmap.yaml          # Rule thresholds + app config
│   │       ├── secret.template.yaml    # Secret template (fill in values)
│   │       ├── transaction-service.yaml# Deployment + Service + PDB
│   │       ├── hpa-keda.yaml           # HPA + KEDA + CronJob pre-scaling
│   │       └── ingress.yaml            # AWS ALB Ingress
│   └── helm/
│       └── transaction-service/        # Helm chart
│
├── scripts/
│   └── seed-transactions.sh            # Load test data
│
└── .github/workflows/deploy.yml        # CI/CD pipeline
```

---

## Run tests

```bash
# Java unit tests (all services)
cd backend
mvn test

# Java integration tests (requires Docker — Testcontainers)
mvn verify -Pintegration -pl transaction-service

# Angular tests
cd frontend
npm test -- --watch=false

# Specific test class
mvn test -Dtest=RuleEngineTest -pl transaction-service
```

---

## Configure OpenAI (AI Query feature)

1. Get an API key from https://platform.openai.com
2. Set it in `.env`:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Or pass directly when running:
   ```bash
   cd backend/ai-query-service
   mvn spring-boot:run -DOPENAI_API_KEY=sk-your-key-here
   ```

The AI query uses `gpt-4o-mini` by default (cheap, fast). Change in `application.yml`:
```yaml
ai:
  openai:
    model: gpt-4o   # or gpt-3.5-turbo for lowest cost
```

**Without an API key:** The circuit breaker fallback activates automatically — the AI query screen still works using keyword search against the sample transaction data.

---

## Adjust rule thresholds

All thresholds are in `backend/transaction-service/src/main/resources/application.yml`:

```yaml
rules:
  aml:
    threshold: 10000       # Transactions above this trigger AML flag
  velocity:
    max-per-hour: 20       # Max transactions per account per hour
  risk:
    flag-threshold: 50     # Risk score at which status → FLAGGED
    aml-score: 40          # Risk points added for AML threshold breach
    velocity-score: 30     # Risk points added for velocity breach
    duplicate-score: 60    # Risk points added for duplicate detection
```

In Kubernetes (AWS), update `infra/k8s/base/configmap.yaml` and apply:
```bash
kubectl apply -f infra/k8s/base/configmap.yaml
kubectl rollout restart deployment/transaction-service -n fintrack
```

---

## Deploy to AWS

### Prerequisites
- AWS CLI configured (`aws configure`)
- eksctl or existing EKS cluster
- ECR repositories created for each service
- RDS SQL Server instance (or use H2 for initial testing)
- ElastiCache Redis cluster

### Step 1 — Fill in secrets
```bash
cp infra/k8s/base/secret.template.yaml infra/k8s/base/secret.yaml
# Edit secret.yaml with your real values
# NEVER commit secret.yaml to git
```

### Step 2 — Update ConfigMap with your AWS values
```bash
# Edit infra/k8s/base/configmap.yaml
# Update: APP_CORS_ALLOWED_ORIGINS to your domain
```

### Step 3 — Add GitHub Secrets for CI/CD
In your GitHub repository → Settings → Secrets:
```
AWS_ACCOUNT_ID       = 123456789012
AWS_REGION           = us-east-1
AWS_ACCESS_KEY_ID    = AKIA...
AWS_SECRET_ACCESS_KEY= ...
OPENAI_API_KEY       = sk-...
```

### Step 4 — Push to main to trigger deployment
```bash
git add .
git commit -m "feat: initial deployment"
git push origin main
# GitHub Actions runs: test → build → push to ECR → deploy to EKS
```

### Step 5 — Update Ingress with your domain
```bash
# Edit infra/k8s/base/ingress.yaml
# Replace: fintrack.yourdomain.com with your actual domain
# Replace: <YOUR_ACM_CERT_ARN> with your ACM certificate ARN
kubectl apply -f infra/k8s/base/
```

---

## Kafka topics created automatically

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| `transaction-events` | TransactionService | WebSocket Relay | Live transaction updates → Angular |
| `compliance-events` | TransactionService | Compliance Service | AML/SAR/CTR signals → downstream |
| `audit-events` | Multiple services | WebSocket Relay | Audit trail → Angular detail view |

Browse all topics at http://localhost:8090 (Kafka UI).

---

## Monitoring

**Prometheus:** http://localhost:9090
- Query: `http_server_requests_seconds_count{application="transaction-service"}`

**Grafana:** http://localhost:3000 (admin / fintrack123)
- Import dashboard ID `4701` for Spring Boot metrics
- Import dashboard ID `7589` for JVM metrics

**Actuator endpoints:**
- http://localhost:8081/actuator/health — service health
- http://localhost:8081/actuator/metrics — all metrics
- http://localhost:8081/actuator/prometheus — Prometheus format

---

## Troubleshooting

**Kafka connection refused:**
```bash
docker-compose logs kafka | tail -20
# Wait for: "Kafka Server started"
```

**H2 console shows no tables:**
```bash
# Connect with: JDBC URL = jdbc:h2:mem:fintrackdb
# Username: sa, Password: (empty)
```

**Angular proxy errors (404 on /api/...):**
```bash
# Ensure all Java services are running on their ports
curl http://localhost:8081/actuator/health
curl http://localhost:8082/api/ai/health
```

**OpenAI 401 error:**
```bash
# Check your API key is set and valid
echo $OPENAI_API_KEY
# The app works without it — circuit breaker falls back to keyword search
```

---

## Tech stack summary

| Layer | Tech |
|---|---|
| Backend language | Java 19, Spring Boot 3.2 |
| Frontend | Angular 17, NgRx 17, RxJS 7 |
| Database (local) | H2 in-memory |
| Database (AWS) | MS SQL Server (RDS Multi-AZ) |
| Cache | Redis 7 (ElastiCache on AWS) |
| Event streaming | Apache Kafka 3.6 |
| AI | OpenAI GPT-4o-mini via REST SSE |
| WebSocket | STOMP over SockJS |
| Auth | JWT (local dev: permissive, AWS: Cognito) |
| Containers | Docker + Kubernetes (EKS) |
| CI/CD | GitHub Actions + Helm |
| Observability | Prometheus + Grafana |
