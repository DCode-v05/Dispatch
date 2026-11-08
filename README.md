# Dispatch

**A real-time chat platform split into five NestJS microservices that talk over RabbitMQ, with CI/CD workflows and Kubernetes manifests.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white) ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white) ![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socketdotio&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-FF4438?style=flat&logo=redis&logoColor=white) ![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat&logo=rabbitmq&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white) ![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat&logo=kubernetes&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat&logo=githubactions&logoColor=white)

## Overview

Dispatch is a chat app that I built as a distributed system instead of a single backend. I wanted to learn how the pieces of a microservices stack fit together: service boundaries, an event bus, an API gateway, container orchestration and a deploy pipeline.

It handles direct messages and group rooms, live typing indicators, online/last-seen presence, sent/delivered/seen receipts, an invitation flow for adding people to rooms, and in-app notifications. Everything live goes over WebSockets. The work is divided across five NestJS services, each with its own database, and they talk to each other through RabbitMQ events instead of direct calls. The whole thing runs locally with `docker compose up`, has Kubernetes manifests for a cluster, exposes Prometheus metrics with a Grafana dashboard, and has a CD workflow that triggers Render deploy hooks once CI passes on `main`.

## Key Features

- **Real-time messaging** over Socket.IO: messages, typing indicators and presence updates are pushed to everyone in a room without polling.
- **Direct messages and group rooms** with an invitation system. You send an invite, the recipient accepts or rejects, and the room is created and broadcast to all participants over the socket.
- **Message receipts**: outgoing messages go clock, sent, delivered, seen, with read state tracked per user (`readBy` arrays) and a "mark room as read" path.
- **Presence and last-seen** tracking backed by Redis, plus typing indicators scoped to the current room.
- **Authentication with account protection**: JWT auth, passwords hashed with bcrypt at 12 rounds, and a lockout after 5 failed logins that lasts 15 minutes.
- **API gateway** (NGINX) in front of every service. It handles CORS, applies per-route rate limits, and upgrades WebSocket connections to the right service by namespace.
- **Event-driven backend**: services emit and consume domain events (`message.sent`, `invitation.received`, `room.created`, `messages.read`, `participants.changed`, `message.deleted`) over RabbitMQ.
- **Observability**: every service exposes `/metrics` (prom-client) and health checks (`@nestjs/terminus`), scraped by Prometheus and shown in a Grafana dashboard.
- **API docs**: Swagger UI per service through `@nestjs/swagger`.
- **Deployment setup**: multi-stage Dockerfiles, a Compose stack for local dev, Kubernetes manifests (deployments, services, HPAs, ingress, secrets, PVCs) and GitHub Actions CI and CD workflows.
- **Frontend**: a Next.js 16 app with sign-in/sign-up, a rooms sidebar with unread badges and last-message previews, a chat window with message grouping and date dividers, light/dark themes, and toast/modal UI.

## How It Works

### Service decomposition

The backend is five NestJS services, each with a single responsibility and its own data store:

| Service | Port | Store | Responsibility |
|---|---|---|---|
| **user-service** | 3001 | PostgreSQL | Auth (JWT), registration, profiles, password hashing, login lockout |
| **chat-service** | 3002 | MongoDB | Rooms, members, invitations, and the Socket.IO gateway |
| **message-service** | 3003 | MongoDB | Message persistence, history pagination, read receipts |
| **notification-service** | 3004 | Redis | In-app notifications and unread fan-out |
| **presence-service** | 3005 | Redis | Online/offline state and last-seen timestamps |

The store follows the data: user records are relational, so they go to Postgres (via TypeORM). Rooms and messages go to MongoDB (via Mongoose), and the short-lived presence and notification state lives in Redis.

### Request and event flow

All outside traffic goes through NGINX (`gateway/nginx.conf`). The gateway routes `/api/auth` and `/api/users` to user-service, `/api/rooms` and `/api/invitations` to chat-service, `/api/messages` to message-service, and so on, and proxies `/socket.io/` upgrades to the right service by inspecting the `nsp` query arg. It also enforces rate limits at the edge, 30 req/s for general API routes and 5 req/s for auth, and strips and re-adds CORS headers so the browser sees one origin.

Services don't call each other over HTTP. When something happens, a service emits an event onto RabbitMQ and any service that cares reacts. Sending a message works like this:

1. The client emits `send_message` over the socket. The chat gateway validates the sender is a room participant, caps the content at 4000 characters, and broadcasts `new_message` to the room straight away so delivery feels instant.
2. It then emits a `message.create` event onto the bus. The message-service consumes it, writes the message to MongoDB, and emits `message.sent` to both notification-service (for the unread badge) and back to chat-service.
3. Read receipts work the same way: `markRoomAsRead` updates the `readBy` set and emits `messages.read`, which the chat gateway relays to the room so other clients update their seen indicators.

Invitations are event-driven too. Accepting an invite emits `invitation.accepted` and `room.created`, and the chat gateway joins the participants' connected sockets to the new room and emits `room_created`, so their UIs update without a refresh.

### WebSocket gateway

The chat-service hosts the Socket.IO gateway. On connect, it verifies the JWT from either the handshake auth payload or the `Authorization` header, then joins the socket to a per-user channel (`user:<id>`), an email channel (used to address invitations before the recipient is in the room), and every room the user already belongs to. CORS origins are parsed from `FRONTEND_URL` with trailing slashes stripped, so a badly formatted origin doesn't silently reject the WebSocket. Disconnects are left to Socket.IO's own room cleanup.

### Auth and hardening

user-service handles registration and login. Passwords are hashed with bcryptjs at 12 rounds. Login tracks failed attempts: after 5 failures the account is locked for 15 minutes, and a successful login resets the counter. Each service validates its environment at boot (the JWT secret is required), and the services use `helmet` and `@nestjs/throttler` on top of the gateway rate limiting.

### Frontend

The frontend is a Next.js 16 / React 19 app using the app router, with state in Zustand stores (auth, chat, presence, theme, toast) and a thin Socket.IO client layer. It splits routes into an `(auth)` group (login, signup) and a `(main)` group (rooms list, chat room, settings). Messages are grouped into 5-minute windows with date dividers, the input auto-resizes, and the sent/delivered/seen state is shown as check marks. The theme is light, dark or system.

## Results / Highlights

No formal benchmarks, since this is a learning project. What is in the repo:

- **5 independent services**, 3 kinds of datastore (PostgreSQL, MongoDB, Redis) and a RabbitMQ event bus, all started by one Compose file with health checks. `docker-compose.override.yml` is picked up automatically and runs each service with `start:dev` and your source mounted.
- **CI** (`.github/workflows/ci.yml`) runs on pushes to `main` and `develop` and on pull requests to `main`. It builds a 6-package matrix (frontend plus 5 services) on Node 22: lint, build and unit tests, against live Postgres, MongoDB, Redis and RabbitMQ service containers. `cd.yml` runs after a successful CI run on `main` and triggers Render deploy hooks for each service.
- **Edge rate limiting** of 30 req/s (API) and 5 req/s (auth) with burst allowances, set in NGINX.
- **Brute-force protection**: bcrypt at 12 rounds, a 5-attempt lockout and a 15-minute cooldown.
- **Two Horizontal Pod Autoscalers** (chat-service, message-service) in the k8s manifests, PVCs for the databases and RabbitMQ, and ingress, secrets and configmaps.
- **k6 load and stress scripts**, a Postman collection and an integration-test compose file under `testing/`. No benchmark results are included.

## Tech Stack

- **Languages:** TypeScript (primary), JavaScript, plus YAML / Dockerfile / NGINX config for infra.
- **Frontend:** Next.js 16, React 19, Tailwind CSS, Zustand, Socket.IO client, Axios.
- **Backend:** Node.js 22, NestJS 11, Socket.IO, TypeORM (Postgres), Mongoose (MongoDB), Passport/JWT, bcryptjs, helmet, `@nestjs/throttler`, `@nestjs/swagger`, `@nestjs/terminus`.
- **Data stores:** PostgreSQL 16, MongoDB 7, Redis 7.
- **Messaging / gateway:** RabbitMQ 3.13 (event bus), NGINX (API gateway, non-root on 8080).
- **Infra:** Docker + Docker Compose, Kubernetes (deployments, services, HPAs, ingress, secrets, PVCs), GitHub Actions CI/CD, Render (deploy target).
- **Observability / testing:** Prometheus + Grafana, prom-client, Jest (unit + e2e), Supertest, k6, Postman; Husky + ESLint + Prettier for repo hygiene.

## Getting Started

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- `kubectl` (only if you want the Kubernetes path)

### Installation

```bash
git clone https://github.com/DCode-v05/Dispatch.git
cd Dispatch
cp .env.example .env
# Edit .env and set at least JWT_SECRET and the database and broker passwords
```

### Running

Bring up the whole stack (all 5 services, Postgres, MongoDB, Redis, RabbitMQ, NGINX and the frontend):

```bash
docker compose up -d --build
```

Then:

- **Web app:** http://localhost
- **RabbitMQ console:** http://localhost:15672 (user `chatadmin`)
- **Swagger docs:** each service serves them at `/docs` on its own port

`docker-compose.override.yml` is applied automatically, so services run in watch mode with your source mounted. To work on a single service outside Docker:

```bash
cd services/user-service
npm install
npm run start:dev
```

Optional: start the monitoring stack (Prometheus + Grafana):

```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

Optional: deploy to a Kubernetes cluster:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/
```

The values in `k8s/secrets/` are placeholders. Replace them before deploying anywhere real.

## Usage

Sign up, then sign in to get a JWT. From the rooms page, create or open a room, or accept an invitation someone sent you. Send a message and the indicator moves from a clock to a single check to a double check as it goes sent, delivered, seen. Typing shows up live for the other people in the room, and presence dots show who's online. The theme switch is on the settings page. For load testing, the k6 scripts and Postman collection are under `testing/`, and each service's Swagger UI lets you try the REST API directly.

## Project Structure

```
Dispatch/
├── frontend/                     # Next.js 16 app (app router, Zustand stores, Socket.IO client)
│   └── src/
│       ├── app/                  # (auth) and (main) route groups
│       ├── components/           # chat / layout / ui components
│       ├── stores/               # auth, chat, presence, theme, toast
│       └── lib/                  # api client, socket, helpers
│
├── services/
│   ├── user-service/             # auth, profiles, login lockout (PostgreSQL)
│   ├── chat-service/             # rooms, invitations, Socket.IO gateway (MongoDB)
│   ├── message-service/          # message persistence + receipts (MongoDB)
│   ├── notification-service/     # in-app notifications (Redis)
│   └── presence-service/         # online / last-seen (Redis)
│
├── gateway/                      # NGINX config (routing, CORS, rate limits) + Dockerfile
├── k8s/                          # Kubernetes manifests
│   ├── databases/                # Postgres, MongoDB, Redis deployments + PVCs
│   ├── services/                 # per-service deployments + services
│   ├── hpa/                      # chat + message autoscalers
│   ├── ingress/  configmaps/  secrets/  rabbitmq/  frontend/  gateway/
│   └── namespace.yaml
│
├── monitoring/                   # Prometheus + Grafana (dashboards, datasource, compose)
├── testing/                      # k6 load/stress scripts, Postman collection, integration compose
├── .github/workflows/            # ci.yml (build matrix) + cd.yml (Render deploy hooks)
├── scripts/run-in-each.js        # monorepo helper: run a script in every package
├── docker-compose.yml            # local dev stack
├── docker-compose.override.yml   # dev overrides: start:dev with source mounted
└── package.json                  # root tooling (Husky, lint:all / build:all / test:all)
```

---

## Contact

<table>
  <tr><td><b>Portfolio:</b> <a href="https://www.denistan.me">Denistan</a></td><td><b>LinkedIn:</b> <a href="https://www.linkedin.com/in/denistanb">denistanb</a></td></tr>
  <tr><td><b>GitHub:</b> <a href="https://github.com/DCode-v05">DCode-v05</a></td><td><b>LeetCode:</b> <a href="https://leetcode.com/u/Denistan_B">Denistan_B</a></td></tr>
  <tr><td colspan="2" align="center"><b>Email:</b> <a href="mailto:denistanb05@gmail.com">denistanb05@gmail.com</a></td></tr>
</table>

Made with ❤️ by **Denistan B**
