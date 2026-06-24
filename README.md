# Dispatch

**A real-time chat platform split into five NestJS microservices, wired together over RabbitMQ, and shipped through a full CI/CD and Kubernetes setup.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white) ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white) ![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socketdotio&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-FF4438?style=flat&logo=redis&logoColor=white) ![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat&logo=rabbitmq&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white) ![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat&logo=kubernetes&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat&logo=githubactions&logoColor=white)

## Overview

Dispatch is a chat app that I built as a distributed system rather than a single backend, mostly to learn how the pieces of a real microservices stack fit together — service decomposition, an event bus, an API gateway, container orchestration, and a deploy pipeline that ships on its own.

It handles direct messages and group rooms, live typing indicators, online/last-seen presence, sent/delivered/seen receipts, an invitation flow for adding people to rooms, and in-app notifications. Everything live travels over WebSockets. Instead of one monolith, the work is divided across five independent NestJS services, each owning its own database and talking to the others through RabbitMQ events rather than direct calls. The whole thing runs locally with one `docker compose up`, has Kubernetes manifests for a real cluster, exposes Prometheus metrics behind Grafana dashboards, and deploys to Render automatically once CI goes green.

## Key Features

- **Real-time messaging** over Socket.IO — messages, typing indicators, and presence updates pushed to everyone in a room without polling.
- **Direct messages and group rooms** with an invitation system: send an invite, the recipient accepts or rejects, and the room is created and broadcast to all participants over the socket.
- **Message receipts** — outgoing messages move through clock → sent → delivered → seen, with read state tracked per user (`readBy` arrays) and a "mark room as read" path.
- **Presence and last-seen** tracking backed by Redis, plus typing indicators scoped to the current room.
- **Authentication with account protection** — JWT auth, passwords hashed with bcrypt at 12 rounds, and brute-force lockout (5 failed logins locks the account for 15 minutes).
- **API gateway** (NGINX) that fronts every service, handles CORS, applies per-route rate limits, and upgrades WebSocket connections to the right service by namespace.
- **Event-driven backend** — services emit and consume domain events (`message.sent`, `invitation.received`, `room.created`, `messages.read`, `participants.changed`, `message.deleted`) over RabbitMQ instead of calling each other directly.
- **Observability** — every service exposes `/metrics` (prom-client) and `/health` liveness/readiness checks (`@nestjs/terminus`), scraped by Prometheus and visualized in a Grafana dashboard.
- **Auto-generated API docs** — Swagger UI per service via `@nestjs/swagger`.
- **Full deploy story** — multi-stage Dockerfiles, a Compose stack for local dev, Kubernetes manifests (deployments, services, HPAs, ingress, secrets, PVCs), and a GitHub Actions CI/CD pipeline.
- **A real frontend** — Next.js 16 app with sign-in/sign-up, a rooms sidebar with unread badges and last-message previews, a chat window with message grouping and date dividers, light/dark themes, and toast/modal UI.

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

The store choice follows the data: relational user records go to Postgres (via TypeORM), rooms and messages go to MongoDB (via Mongoose), and the volatile presence/notification state lives in Redis.

### Request and event flow

External traffic only ever hits NGINX. The gateway routes `/api/auth` and `/api/users` to user-service, `/api/rooms` and `/api/invitations` to chat-service, `/api/messages` to message-service, and so on, and proxies `/socket.io/` upgrades to the right service by inspecting the `nsp` query arg. It also enforces rate limits at the edge — 30 req/s for general API routes and a tighter 5 req/s on auth — and strips and re-adds CORS headers so the browser sees one consistent origin.

Services don't call each other over HTTP. When something happens, a service emits an event onto RabbitMQ and any interested service reacts. For example, sending a message:

1. The client emits `send_message` over the socket. The chat gateway validates the sender is a room participant, trims the content to a 4000-char cap, and immediately broadcasts `new_message` to everyone in the room socket-room so delivery feels instant.
2. It then emits a `message.create` event onto the bus. The message-service consumes it, writes the message to MongoDB, and emits `message.sent` to both notification-service (for the unread badge) and back to chat-service.
3. Read receipts work the same way — `markRoomAsRead` updates the `readBy` set and emits `messages.read`, which the chat gateway relays to the room so other clients update their seen indicators.

The invitation flow is also event-driven: accepting an invite emits `invitation.accepted` / `room.created`, and the chat gateway loops over connected sockets, joins the relevant participants to the new room, and emits `room_created` so their UIs update live without a refresh.

### WebSocket gateway

The chat-service hosts the Socket.IO gateway. On connect, it verifies the JWT from either the handshake auth payload or the `Authorization` header, then joins the socket to a per-user channel (`user:<id>`), an email channel (used to address invitations before the recipient is in the room), and every room the user already belongs to. CORS origins are parsed from `FRONTEND_URL` with trailing slashes stripped, so a misconfigured origin doesn't silently reject the WebSocket. Disconnects are left to Socket.IO's own room cleanup.

### Auth and hardening

user-service handles registration and login. Passwords are hashed with bcryptjs at 12 rounds. Login tracks failed attempts: after 5 failures the account is locked for 15 minutes, and a successful login resets the counter. Each service validates its environment at boot (the JWT secret is required), and the services pull in `helmet` and `@nestjs/throttler` on top of the gateway-level rate limiting.

### Frontend

The frontend is a Next.js 16 / React 19 app using the app router, with state in Zustand stores (auth, chat, presence, theme, toast) and a thin Socket.IO client layer. It splits routes into an `(auth)` group (login, signup) and a `(main)` group (rooms list, chat room, settings). Messages are grouped into 5-minute windows with date dividers, the input auto-resizes, and the sent/delivered/seen state is rendered as transitioning check marks. Theme is light/dark/system with no flash of unstyled content on SSR.

## Results / Highlights

No formal benchmarks — this is a learning-grade project — but the concrete, verifiable shape of it:

- **5 independent services**, 3 different datastore types (PostgreSQL, MongoDB, Redis), and a RabbitMQ event bus, all brought up by a single Compose file with health checks.
- **CI runs a 6-package build matrix** (frontend + 5 services) in parallel on Node 22, doing lint → type-check/build → unit tests against live Postgres/Mongo/Redis/RabbitMQ service containers on every push and PR.
- **Edge rate limiting** of 30 req/s (API) and 5 req/s (auth) with burst allowances, configured in NGINX.
- **Brute-force protection**: bcrypt at 12 rounds, 5-attempt lockout, 15-minute cooldown.
- **Two Horizontal Pod Autoscalers** (chat-service, message-service) in the k8s manifests, plus PVCs for each stateful database and a full ingress/secrets/configmap setup.
- **k6 load and stress scripts** and a Postman collection included for testing the platform under load.

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
# Edit .env — at minimum set JWT_SECRET and the database / broker passwords
```

### Running

Bring up the whole stack — all 5 services, Postgres, MongoDB, Redis, RabbitMQ, NGINX, and the frontend:

```bash
docker compose up -d --build
```

Then:

- **Web app:** http://localhost
- **RabbitMQ console:** http://localhost:15672 (user `chatadmin`)
- **Swagger docs:** available per service (e.g. `/api/users/docs`)

To work on a single service in watch mode:

```bash
cd services/user-service
npm install
npm run start:dev
```

Optional — start the monitoring stack (Prometheus + Grafana):

```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

Optional — deploy to a Kubernetes cluster:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/
```

## Usage

Sign up, then sign in to get a JWT. From the rooms page, create or open a room (or accept an invitation someone sent you). Send a message and watch the indicator move from clock to single check to double check as it goes sent → delivered → seen. Typing shows up live for the other people in the room, and presence dots reflect who's online. Theme switching lives on the settings page. For load testing, the k6 scripts and Postman collection are under `testing/`, and each service's Swagger UI lets you poke the REST API directly.

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
└── package.json                  # root tooling (Husky pre-commit)
```

---

## Contact

<table>
  <tr><td><b>Portfolio:</b> <a href="https://www.denistan.me">Denistan</a></td><td><b>LinkedIn:</b> <a href="https://www.linkedin.com/in/denistanb">denistanb</a></td></tr>
  <tr><td><b>GitHub:</b> <a href="https://github.com/DCode-v05">DCode-v05</a></td><td><b>LeetCode:</b> <a href="https://leetcode.com/u/Denistan_B">Denistan_B</a></td></tr>
  <tr><td colspan="2" align="center"><b>Email:</b> <a href="mailto:denistanb05@gmail.com">denistanb05@gmail.com</a></td></tr>
</table>

Made with ❤️ by **Denistan B**
