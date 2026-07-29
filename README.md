<div align="center">

# ⚙️ LeetCAD

**Event-driven CAD assessment platform with AI-powered engineering review.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-FF6600?logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*A Turborepo monorepo with NestJS/Fastify API edge, isolated Python subprocess workers, Gemini Vision AI integration, and horizontally scalable WebSocket delivery — designed to demonstrate production-grade distributed systems patterns.*

</div>

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Core** | Node.js, NestJS, Fastify, TypeScript |
| **Data & Messaging** | PostgreSQL 16, RabbitMQ 3.13 (DLX/DLQ), Redis 7 |
| **Storage & AI** | MinIO (S3-compatible), Google Gemini 2.5 Flash Vision |
| **Workers** | Python 3.10, CadQuery, PyVista, OpenCASCADE |
| **Observability** | OpenTelemetry (auto-instrumentation), Winston (structured JSON) |
| **Security** | Google OAuth2, JWT (Passport), Zod, Helmet, CORS, Throttler |
| **DevOps** | Docker Compose, Turborepo |

---

## 🏗 Architecture

```mermaid
flowchart LR
    subgraph Client
        FE["Frontend (SPA)"]
    end

    subgraph API Edge
        NestJS["NestJS / Fastify\n:3000"]
    end

    subgraph Data Layer
        PG["PostgreSQL 16\n(Outbox Table)"]
    end

    subgraph Message Broker
        RMQ["RabbitMQ 3.13\n(DLX + DLQ)"]
    end

    subgraph Workers
        PY["Python Subprocess\n(CadQuery + PyVista)"]
        GEMINI["Gemini 2.5 Flash\n(Vision AI)"]
    end

    subgraph Object Store
        S3["MinIO S3\n(CAD files + Reports)"]
    end

    subgraph Realtime
        WS["Socket.io Server\n:3001"]
        REDIS["Redis 7\n(Pub/Sub + Leaderboard)"]
    end

    FE -- "REST + JWT" --> NestJS
    NestJS -- "INSERT (tx)" --> PG
    PG -- "SKIP LOCKED poll" --> RMQ
    RMQ -- "SubmissionUploaded" --> PY
    PY -- "SIGKILL @ 60s" --> PY
    PY -- "parse STEP/STL" --> S3
    PY -- "stdout JSON" --> GEMINI
    GEMINI -- "Markdown report" --> S3
    S3 -. "S3 keys only" .-> RMQ
    RMQ -- "AssessmentCompleted" --> WS
    WS <-- "Redis Adapter" --> REDIS
    WS -- "assessment.completed" --> FE
    NestJS -. "Fencing Token" .-> REDIS
```

---

## 🔄 Execution Flow

> The complete lifecycle of a CAD submission — from upload to real-time result delivery.

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                         REQUEST PATH                                    │
 ├─────────────────────────────────────────────────────────────────────────┤
 │                                                                         │
 │  1 │ Client calls POST /storage/presigned-url                           │
 │    │ → API returns a signed MinIO PUT URL + fileKey                     │
 │    │                                                                    │
 │  2 │ Client uploads CAD file (STEP/STL) directly to MinIO               │
 │    │ → Bypasses API server entirely (no memory pressure)                │
 │    │                                                                    │
 │  3 │ Client calls POST /submissions/complete { fileKey }                │
 │    │ → API inserts Submission record + OutboxEvent                      │
 │    │ → Both writes in a SINGLE PostgreSQL transaction                   │
 │    │                                                                    │
 ├─────────────────────────────────────────────────────────────────────────┤
 │                         ASYNC PIPELINE                                  │
 ├─────────────────────────────────────────────────────────────────────────┤
 │    │                                                                    │
 │  4 │ Outbox Relay polls with FOR UPDATE SKIP LOCKED                     │
 │    │ → Publishes SubmissionUploaded to RabbitMQ exchange                 │
 │    │ → Marks outbox row as processed                                    │
 │    │                                                                    │
 │  5 │ Assessment Engine consumes message                                 │
 │    │ → Downloads CAD file from MinIO to temp directory                   │
 │    │ → Spawns isolated Python subprocess (CadQuery + PyVista)           │
 │    │ → Enforces 60-second SIGKILL hard timeout                          │
 │    │ → Parses stdout JSON: { volume, surfaceArea, centerOfMass }        │
 │    │                                                                    │
 │  6 │ Worker sends PNG render + metrics to Gemini 2.5 Flash              │
 │    │ → Receives Markdown engineering review                             │
 │    │ → Uploads PNG + report to MinIO (Claim-Check pattern)              │
 │    │                                                                    │
 │  7 │ Worker checks Redis fencing token (INCR)                           │
 │    │ → If fence = 1: writes results to PostgreSQL                       │
 │    │ → If fence > 1: drops write (zombie/duplicate detected)            │
 │    │ → Publishes AssessmentCompleted event to RabbitMQ                   │
 │    │                                                                    │
 │  8 │ Realtime Service consumes AssessmentCompleted                      │
 │    │ → Updates Redis leaderboard (ZADD)                                 │
 │    │ → Broadcasts to user's WebSocket room via Redis adapter            │
 │    │                                                                    │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Monorepo Structure

```
├── apps/
│   ├── core-platform/          NestJS/Fastify API, Auth, Storage, Outbox Relay
│   ├── assessment-engine/      RabbitMQ consumer, Python subprocess, Gemini AI
│   └── realtime-service/       Socket.io + Redis adapter, RabbitMQ consumer
├── packages/
│   └── shared-types/           Cross-service TypeScript interfaces and enums
├── docker-compose.yml          PostgreSQL, Redis, RabbitMQ, MinIO
├── .env.example                Environment variable template
└── turbo.json                  Build pipeline configuration
```

---

## 🗄 Database Schema

### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PK, auto-generated` | Unique user identifier |
| `email` | `varchar` | `UNIQUE, NOT NULL` | Google account email |
| `googleId` | `varchar` | `UNIQUE, NOT NULL` | Google OAuth `sub` claim |
| `name` | `varchar` | `NOT NULL` | Display name from Google profile |
| `createdAt` | `timestamp` | `auto` | Account creation timestamp |
| `updatedAt` | `timestamp` | `auto` | Last profile update |

### `submissions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PK, auto-generated` | Unique submission identifier |
| `userId` | `varchar` | `NOT NULL` | Submitting user reference |
| `fileKey` | `varchar` | `NOT NULL` | MinIO S3 object key for uploaded CAD file |
| `status` | `varchar` | `DEFAULT 'PENDING'` | One of: `PENDING`, `UPLOADED`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `score` | `float` | `NULLABLE` | Computed assessment score (0–100) |
| `aiReportId` | `varchar` | `NULLABLE` | MinIO S3 key for Gemini-generated report |
| `metrics` | `jsonb` | `NULLABLE` | `{ volume, surfaceArea, centerOfMass: [x,y,z] }` |
| `createdAt` | `timestamp` | `auto` | Submission timestamp |
| `updatedAt` | `timestamp` | `auto` | Last status change |

### `outbox_events`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PK, auto-generated` | Event identifier |
| `aggregateType` | `varchar` | `NOT NULL` | Source entity type (e.g., `Submission`) |
| `aggregateId` | `varchar` | `NOT NULL` | Source entity ID |
| `eventType` | `varchar` | `NOT NULL` | Event name (e.g., `SubmissionUploaded`) |
| `payload` | `jsonb` | `NOT NULL` | Full event payload |
| `processed` | `boolean` | `DEFAULT false` | Relay completion flag |
| `createdAt` | `timestamp` | `auto` | Event creation timestamp |

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar googleId UK
        varchar name
        timestamp createdAt
        timestamp updatedAt
    }

    submissions {
        uuid id PK
        varchar userId FK
        varchar fileKey
        varchar status
        float score
        varchar aiReportId
        jsonb metrics
        timestamp createdAt
        timestamp updatedAt
    }

    outbox_events {
        uuid id PK
        varchar aggregateType
        varchar aggregateId
        varchar eventType
        jsonb payload
        boolean processed
        timestamp createdAt
    }

    users ||--o{ submissions : "has many"
    submissions ||--o{ outbox_events : "emits"
```

---

## 📡 API Specification

> Interactive Swagger UI available at `http://localhost:3000/api` when the core-platform is running.

### `POST /auth/google` — Stateless Google OAuth Login

> **Auth:** None

**Request:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response `201`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `401`:**
```json
{
  "statusCode": 401,
  "message": "Failed to verify Google token"
}
```

---

### `POST /storage/presigned-url` — Generate MinIO Upload URL

> **Auth:** `Authorization: Bearer <JWT>`

**Request:**
```json
{
  "filename": "bracket-assembly.step",
  "contentType": "application/step"
}
```

**Response `201`:**
```json
{
  "uploadUrl": "http://localhost:9000/leetcad-uploads/user-uuid/file-uuid-bracket-assembly.step?X-Amz-Algorithm=...",
  "fileKey": "user-uuid/file-uuid-bracket-assembly.step"
}
```

**Response `400`:**
```json
{
  "statusCode": 400,
  "message": "Validation failed"
}
```

---

### `POST /submissions/complete` — Mark Upload Complete & Trigger Assessment

> **Auth:** `Authorization: Bearer <JWT>`

**Request:**
```json
{
  "fileKey": "user-uuid/file-uuid-bracket-assembly.step"
}
```

**Response `201`:**
```json
{
  "id": "submission-uuid",
  "userId": "user-uuid",
  "fileKey": "user-uuid/file-uuid-bracket-assembly.step",
  "status": "UPLOADED",
  "score": null,
  "aiReportId": null,
  "metrics": null,
  "createdAt": "2026-07-28T10:30:00.000Z",
  "updatedAt": "2026-07-28T10:30:00.000Z"
}
```

---

### `WS ws://localhost:3001` — Real-Time Assessment Notifications

> **Auth:** `?userId=<user-uuid>` query parameter

**Connection:**
```javascript
const socket = io("ws://localhost:3001", {
  query: { userId: "user-uuid" }
});
```

**Event: `assessment.completed`**
```json
{
  "submissionId": "submission-uuid",
  "userId": "user-uuid",
  "status": "COMPLETED",
  "score": 85.5,
  "aiReportId": "reports/submission-uuid/ai-report.md",
  "metrics": {
    "volume": 1234.56,
    "surfaceArea": 789.01,
    "centerOfMass": [0.5, 1.2, 3.4]
  },
  "renderUrls": ["reports/submission-uuid/render.png"]
}
```

---

## 🛡 System Design & Mitigation Strategies

### 1. Transactional Outbox Pattern

**Failure mode prevented:** Distributed transaction failure between PostgreSQL and RabbitMQ. A naive `INSERT` + `channel.publish()` is not atomic — if the process crashes between the two operations, the event is lost permanently. The message broker has no knowledge of the database state, and the database has no knowledge of the broker state.

**Implementation:** All domain events are written to an `outbox_events` table inside the same PostgreSQL transaction as the business entity mutation. A cron-based relay service (`RelayService`) polls the outbox every second using:

```sql
SELECT * FROM outbox_events
WHERE "publishedAt" IS NULL
ORDER BY "createdAt" ASC
FOR UPDATE SKIP LOCKED
LIMIT 50
```

`SKIP LOCKED` is critical. Without it, concurrent relay instances (or overlapping cron ticks) will deadlock on the same rows. `SKIP LOCKED` causes competing transactions to silently skip already-locked rows instead of blocking, enabling safe horizontal scaling of the relay without coordination.

Each polled event is published to RabbitMQ's `leetcad.events` exchange with a routing key matching the event type. The row's `publishedAt` timestamp is then set, marking it as delivered. If the relay crashes mid-batch, unpublished rows remain `NULL` and are retried on the next tick — achieving at-least-once delivery semantics.

**Dead Letter Exchange (DLX):** Messages that are rejected or expire are routed to `leetcad.events.dlx` → `leetcad.events.dlq` for forensic inspection. Consumer failures never silently disappear.

---

### 2. Claim-Check Pattern

**Failure mode prevented:** RabbitMQ memory exhaustion and broker instability from publishing large binary payloads directly to the message queue.

**Implementation:** The assessment engine produces two heavy artifacts per submission:
1. A rendered PNG image of the CAD geometry (~500KB–5MB)
2. A Gemini-generated Markdown engineering report (~10KB–50KB)

Neither artifact is published to RabbitMQ. Instead, both are uploaded to MinIO via `PutObjectCommand`, and only the resulting S3 keys are included in the `AssessmentCompleted` event payload:

```typescript
{
  submissionId: "uuid",
  userId: "uuid",
  score: 85.5,
  s3ReportKey: "reports/<submissionId>/ai-report.md",
  s3ImageKey: "reports/<submissionId>/render.png"
}
```

Downstream consumers (realtime-service, frontend) dereference the S3 keys on demand. The message broker never handles payloads larger than a few hundred bytes.

---

### 3. Fencing Tokens (Zombie Worker Prevention)

**Failure mode prevented:** A slow or "zombie" worker that was assumed dead (due to a network partition or GC pause) regains connectivity and overwrites the database with stale results, corrupting the submission state.

**Implementation:** Before writing assessment results to PostgreSQL, the worker executes:

```typescript
const fence = await redis.incr(`submission:${submissionId}:fence`);
if (fence > 1) {
  console.warn("Zombie worker or duplicate delivery detected. Dropping write.");
  channel.ack(msg);
  return;
}
```

`INCR` is atomic in Redis. The first worker to reach this point gets `1` and proceeds to write. Any subsequent worker (redelivered message, duplicate consumer) gets `> 1` and aborts. This is a lightweight optimistic concurrency lock that prevents last-write-wins corruption without requiring distributed consensus.

The message is still `ack`'d on the duplicate path to prevent infinite redelivery loops.

---

### 4. Process Isolation & Hard Boundaries

**Failure mode prevented:** C++ OpenCASCADE segfaults, infinite loops in geometric kernel computations, and locked native threads crashing or freezing the Node.js event loop.

**Implementation:** CAD parsing is executed in a fully isolated Python subprocess via `child_process.spawn`. The Node.js process never loads CadQuery, PyVista, or any OpenCASCADE bindings into its own address space.

The subprocess wrapper enforces a hard 60-second timeout:

```typescript
const timeout = setTimeout(() => {
  subprocess.kill("SIGKILL");
  reject(new Error("Process killed due to 60s timeout"));
}, 60_000);
```

`SIGKILL` is used deliberately — `SIGTERM` is insufficient because locked C++ threads in the OpenCASCADE kernel will ignore cooperative termination signals. `SIGKILL` is non-interceptable and guarantees process termination at the OS level.

The timeout is cleared via `clearTimeout` on normal exit or error to prevent timer leaks. Temporary files (STEP input, PNG output) are cleaned up in a `finally` block regardless of outcome.

---

### 5. Horizontally Scalable WebSockets

**Failure mode prevented:** Localized WebSocket broadcasts. Without coordination, a Socket.io `emit` only reaches clients connected to the emitting server instance. In a multi-instance deployment behind a load balancer, users connected to other instances receive nothing.

**Implementation:** The realtime-service uses the `@socket.io/redis-adapter` to synchronize Socket.io rooms across all instances via Redis Pub/Sub:

```typescript
const pubClient = new Redis("redis://localhost:6379");
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

When any instance calls `io.to("user:<userId>").emit(...)`, the adapter publishes the event to Redis. All other Socket.io instances subscribed to the same Redis channel receive the event and forward it to locally connected clients in that room.

The leaderboard is maintained in a Redis Sorted Set (`ZADD leaderboard:global <score> <userId>`), enabling O(log N) score updates and O(log N + M) range queries across all instances without database round-trips.

---

### 6. Security & Observability

#### Stateless Google OAuth2

Authentication uses a stateless token exchange — no sessions, no server-side OAuth state. The client obtains a Google ID token via the Google Sign-In SDK and sends it to `POST /auth/google`. The server verifies the token's signature and claims against Google's public keys using `google-auth-library`, upserts the user by `googleId`, and returns a signed JWT. All subsequent requests authenticate via the JWT Bearer token validated by Passport.

The JWT secret is loaded from the `JWT_SECRET` environment variable via `@nestjs/config`, with no hardcoded fallback in production.

#### Runtime DTO Validation (Zod)

All request bodies are validated at the pipe level using Zod schemas before reaching controller logic:

```typescript
@UsePipes(new ZodValidationPipe(GoogleLoginSchema))
async googleLogin(@Body() body: GoogleLoginDto) { ... }
```

Invalid payloads are rejected with a `400 BadRequestException` before any business logic executes. Zod schemas serve as the single source of truth for both runtime validation and TypeScript type inference via `z.infer`.

#### API Edge Protection

| Layer | Implementation | Purpose |
|---|---|---|
| Helmet | `@fastify/helmet` via `app.register(helmet)` | Security headers (CSP, HSTS, X-Frame-Options) |
| CORS | `app.enableCors({ origin: true, credentials: true })` | Cross-origin request policy |
| Rate Limiting | `@nestjs/throttler` — 100 req/min/IP, global `ThrottlerGuard` | Brute-force and DDoS mitigation |

#### Distributed Tracing (OpenTelemetry)

The `@opentelemetry/sdk-node` with `getNodeAutoInstrumentations()` is initialized as the **first import** in `main.ts` — before any driver `require()` calls. This ensures the OpenTelemetry monkey-patches are applied to `http`, `pg`, `amqplib`, and `ioredis` before their native modules are loaded.

Trace context (`traceparent` headers) propagates automatically across HTTP boundaries and RabbitMQ message headers, enabling end-to-end latency analysis from API ingress through subprocess execution to WebSocket delivery.

#### Structured Logging

All application logs are emitted as flat JSON via Winston with `format.json()`. No colorization, no `simple()` format, no pretty-print. Every log line is a single JSON object with `timestamp`, `level`, `message`, `context`, `trace_id`, and `span_id` fields — directly ingestible by ELK, Datadog, or any log aggregator without parsing rules.

---

## 📋 Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| **Node.js** | v20+ | Runtime for all TypeScript services |
| **Docker & Docker Compose** | Latest | PostgreSQL, Redis, RabbitMQ, MinIO containers |
| **Python** | 3.10+ | CAD analysis worker (CadQuery, PyVista) |
| **npm** | v10+ | Package management (Turborepo workspaces) |

---

## 🚀 Quick Start

```bash
# 1. Clone and install dependencies
git clone https://github.com/AsyncNigam/LeetCAD-Backend.git
cd LeetCAD-Backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your GEMINI_API_KEY and GOOGLE_CLIENT_ID

# 3. Start infrastructure
docker compose up -d
docker compose ps  # Verify all 4 services are healthy

# 4. Create MinIO buckets
docker exec leetcad-minio mc alias set local http://localhost:9000 leetcad leetcad_dev
docker exec leetcad-minio mc mb local/leetcad-uploads local/leetcad --ignore-existing

# 5. Build all packages
npx turbo run build

# 6. Start services (in separate terminals)
node apps/core-platform/dist/main.js        # API on :3000, Swagger on :3000/api
node apps/realtime-service/dist/index.js     # WebSocket on :3001
```

---

## 🔑 Environment Variables

> Copy `.env.example` to `.env` and configure:

```bash
# Server
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# PostgreSQL
DATABASE_URL=postgresql://leetcad:leetcad_dev@localhost:5432/leetcad_db

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URI=amqp://guest:guest@localhost:5672

# MinIO (S3-compatible)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=leetcad
MINIO_SECRET_KEY=leetcad_dev

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🧪 Testing

```bash
# Build all packages
npx turbo run build

# Lint all packages
npx turbo run lint

# Run unit tests (per service)
npm run test --workspace=@leetcad/core-platform
npm run test --workspace=@leetcad/assessment-engine
npm run test --workspace=@leetcad/realtime-service

# Type-check without emitting
npx tsc --noEmit --project apps/core-platform/tsconfig.json
npx tsc --noEmit --project apps/assessment-engine/tsconfig.json
npx tsc --noEmit --project apps/realtime-service/tsconfig.json
```

---

## 🐳 Infrastructure

| Service | Image | Ports | Credentials |
|---|---|---|---|
| PostgreSQL | `postgres:16-alpine` | `5432` | `leetcad` / `leetcad_dev` |
| Redis | `redis:7-alpine` | `6379` | — |
| RabbitMQ | `rabbitmq:3-management-alpine` | `5672` · `15672` | `guest` / `guest` |
| MinIO | `minio/minio` | `9000` · `9001` | `leetcad` / `leetcad_dev` |

**Management UIs:**
- RabbitMQ Dashboard → `http://localhost:15672`
- MinIO Console → `http://localhost:9001`
- Swagger API Docs → `http://localhost:3000/api`

```bash
docker compose up -d       # Start all containers
docker compose ps          # Health check
docker compose down -v     # Tear down with volumes
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
