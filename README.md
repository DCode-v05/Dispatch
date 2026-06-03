# Dispatch — Real-Time Chat Platform

## Project Description
Dispatch is a production-grade real-time chat platform built on a microservices architecture and a fully automated DevOps pipeline. It supports direct messages and group rooms, live presence and typing indicators, sent/delivered/seen receipts, and push notifications — all delivered over WebSockets with sub-second latency. The system is containerized, observable end-to-end, and ships through a CI/CD pipeline to a managed cloud environment.

---

## Project Details

### Problem Statement
Modern messaging applications must deliver messages in real time, scale horizontally under unpredictable load, stay online during partial failures, and remain observable in production. A monolithic implementation makes it hard to scale individual concerns (chat fan-out vs. authentication vs. presence) independently. Dispatch solves this by splitting responsibilities into independently deployable services, decoupling them through a message broker, and wiring the entire stack into a containerized, monitored, and continuously deployed pipeline.

### Architecture
```
Frontend (Next.js)
        │
        ▼
API Gateway (NGINX)
        │
        ├──► User Service       (PostgreSQL)   — auth, profiles
        ├──► Chat Service       (MongoDB)      — rooms, WebSocket gateway
        ├──► Message Service    (MongoDB)      — message persistence, history
        ├──► Notification Service (Redis)      — alerts, push
        └──► Presence Service   (Redis)        — online / typing state
                          │
                          ▼
                  RabbitMQ (event bus)
```

- **Service Decomposition:** Five independent NestJS services, each owning its own data store and exposing a versioned REST API plus event subscriptions on RabbitMQ.
- **Event-Driven Communication:** Services emit and consume domain events (e.g. `message.created`, `user.online`, `room.member.joined`) over RabbitMQ rather than calling each other synchronously.
- **WebSocket Gateway:** Chat Service hosts a Socket.IO gateway for live message delivery, typing indicators, and presence broadcasts.
- **API Gateway:** NGINX terminates external traffic, routes `/api/*` to the correct service, and proxies `/socket.io/*` for WebSocket upgrades.

### Microservices
| Service | Port | Database | Responsibility |
|---|---|---|---|
| User Service | 3001 | PostgreSQL | Authentication (JWT), user profiles, password hashing (bcrypt) |
| Chat Service | 3002 | MongoDB | Chat rooms, members, Socket.IO gateway, typing/presence broadcasts |
| Message Service | 3003 | MongoDB | Message persistence, history pagination, sent/delivered/seen receipts |
| Notification Service | 3004 | Redis | In-app notifications, unread badges, push fan-out |
| Presence Service | 3005 | Redis | Online/offline tracking, last-seen timestamps |

### DevOps & CI/CD
- **Containerization:** Each service ships with a multi-stage hardened Dockerfile (non-root user, minimal Alpine base, production target).
- **Local Orchestration:** `docker-compose.yml` brings up all 5 services + Postgres + MongoDB + Redis + RabbitMQ + NGINX + frontend with health checks and a shared bridge network.
- **CI Pipeline (GitHub Actions, [.github/workflows/ci.yml](.github/workflows/ci.yml)):** lint → typecheck → unit tests → build all services in parallel on every push and pull request.
- **CD Pipeline ([.github/workflows/cd.yml](.github/workflows/cd.yml)):** builds and pushes versioned images, then deploys to the managed cloud environment.
- **Pre-commit Hooks:** Husky runs lint and format checks on staged files before every commit, blocking broken code at the source.
- **Kubernetes Manifests:** Full set of manifests under [k8s/](k8s/) (deployments, services, HPAs, ingress, secrets, PVCs) for self-hosted clusters as an alternative to the managed deployment.

### Configuration
Every service is configured purely via environment variables. The hardening pass made several previously-optional variables mandatory and enforced strong defaults:

```
# Shared
JWT_SECRET=<32+ char secret>          # required, validated at boot
NODE_ENV=production
PORT=3000

# User Service
POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
BCRYPT_ROUNDS=12

# Chat / Message Service
MONGODB_URI=mongodb://user:pass@host:27017/chatplatform?authSource=admin

# Notification / Presence Service
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD

# All services
RABBITMQ_URL=amqp://user:pass@host:5672
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

Copy `.env.example` to `.env` and fill in real values before starting the stack.

### Monitoring & Dashboards
- **Prometheus** scrapes a `/metrics` endpoint exposed by every service (`prom-client`): request rate, latency histograms, WebSocket connection count, RabbitMQ consumer lag.
- **Grafana** dashboards under [monitoring/grafana/dashboards/](monitoring/grafana/dashboards/) visualize the platform overview, per-service latency, error rates, and active socket connections.
- **Health Checks:** Each service exposes `/health` (liveness) and `/health/ready` (readiness) via `@nestjs/terminus`, checking downstream dependencies (DB, broker, Redis).
- **API Documentation:** Swagger UI auto-generated at `/docs` on every service for live request inspection.

### Frontend Application
The Next.js 16 frontend ([frontend/](frontend/)) implements the **"Dispatch" design system**:
- Sign-up / sign-in with JWT, persisted via secure cookies.
- Sidebar with rooms, live last-message previews, relative timestamps, and unread badges.
- Chat window with auto-resizing input, typing indicator, message grouping (5-minute windows), and date dividers.
- Sent · Delivered · Seen indicators on outgoing messages.
- Dual light/dark theme (Space Grotesk display, DM Sans body, JetBrains Mono mono) with system-preference auto-detect and FOUC-free SSR.
- Toast notifications and modal confirmations replacing native `alert()` / `confirm()`.
- Settings page with theme switcher, profile, and sign-out.

---

## Tech Stack
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Zustand, Socket.IO client, Axios
- **Backend:** Node.js 22, NestJS 11, TypeORM, Mongoose, Socket.IO, Passport (JWT)
- **Databases:** PostgreSQL 16, MongoDB 7, Redis 7
- **Message Broker:** RabbitMQ 3.13
- **API Gateway:** NGINX (non-root, runs on port 8080 inside container)
- **Containerization:** Docker, Docker Compose
- **Orchestration:** Kubernetes (manifests provided)
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana
- **Testing:** Jest (unit + e2e), Supertest, k6 (load), Postman collections
- **Tooling:** Husky, ESLint, Prettier, TypeScript 5

---

## Getting Started

### Prerequisites
- Node.js 22+
- Docker & Docker Compose
- (Optional) kubectl, for the Kubernetes deployment path

### 1. Clone the repository
```bash
git clone https://github.com/DCode-v05/Dispatch.git
cd Dispatch
```

### 2. Configure environment variables
```bash
cp .env.example .env
# Edit .env — at minimum, set JWT_SECRET and the database / broker passwords
```

### 3. Start the full stack with Docker Compose
```bash
docker compose up -d --build
```
This builds and starts every service, database, the broker, and the NGINX gateway. The application is then served at:
- **Web app:** http://localhost
- **Swagger docs:** http://localhost/api/users/docs, `/api/chat/docs`, `/api/messages/docs`, etc.
- **RabbitMQ console:** http://localhost:15672 (user: `chatadmin`)
- **Prometheus:** http://localhost:9090 (when monitoring stack is up)
- **Grafana:** http://localhost:3010 (when monitoring stack is up)

### 4. Run an individual service in dev mode
```bash
cd services/user-service
npm install
npm run start:dev
```

### 5. Start the monitoring stack (optional)
```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

### 6. Deploy to Kubernetes (optional)
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/
```

---

## Usage
- **Sign up** at `/signup`, then sign in to receive a JWT cookie.
- **Create or join a room** from the Rooms page, or open a direct message from a user's profile.
- **Send messages** — watch the indicator transition from clock → single check → double check (dim) → double check (accent) as the message reaches sent / delivered / seen states.
- **Switch theme** from the Settings page (light / dark / system).
- **Inspect APIs** via Swagger at `/docs` on each service for live request testing.
- **Load test** with the k6 scripts and Postman collection under [testing/](testing/).

---

## Project Structure
```
Dispatch/
│
├── frontend/                        # Next.js 16 frontend (Dispatch design system)
│   ├── src/app/                     # App router pages (auth + main)
│   ├── src/components/              # UI + chat + layout components
│   ├── src/stores/                  # Zustand stores (chat, theme, toast, presence)
│   └── src/lib/                     # API client, socket client, helpers
│
├── services/
│   ├── user-service/                # Auth, profiles (PostgreSQL)
│   ├── chat-service/                # Rooms + Socket.IO gateway (MongoDB)
│   ├── message-service/             # Message persistence (MongoDB)
│   ├── notification-service/        # Notifications (Redis)
│   └── presence-service/            # Online tracking (Redis)
│
├── gateway/                         # NGINX configuration + Dockerfile
├── k8s/                             # Kubernetes manifests
│   ├── namespace.yaml
│   ├── databases/                   # Postgres, MongoDB, Redis
│   ├── rabbitmq/
│   ├── services/                    # Deployments + Services for each microservice
│   ├── frontend/
│   ├── gateway/
│   ├── hpa/                         # Horizontal Pod Autoscalers
│   ├── ingress/
│   ├── configmaps/
│   └── secrets/
│
├── monitoring/                      # Prometheus + Grafana stack
│   ├── prometheus/prometheus.yml
│   ├── grafana/dashboards/
│   └── docker-compose.monitoring.yml
│
├── testing/
│   ├── integration/                 # docker-compose for integration tests
│   └── postman/                     # Postman collection + environment
│
├── .github/workflows/               # CI + CD pipelines
│   ├── ci.yml
│   └── cd.yml
│
├── scripts/                         # Monorepo helper scripts
├── docker-compose.yml               # Local development stack
├── docker-compose.override.yml      # Dev overrides
├── .env.example                     # Environment variable template
├── package.json                     # Root tooling (Husky)
└── README.md                        # Project documentation
```

---

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-feature
   ```
5. Open a pull request describing your changes.

Please make sure `npm run lint:all` and `npm run test:all` pass at the repo root before opening the PR — Husky will enforce this on commit.

---

## Contact
- **GitHub:** [DCode-v05](https://github.com/DCode-v05)
- **Email:** denistanb05@gmail.com
