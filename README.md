# Dispatch

A real-time chat platform built as five NestJS microservices that talk over RabbitMQ, with a Next.js frontend, an NGINX gateway, Docker Compose for local runs and Kubernetes manifests for a cluster.

I built it to learn how the parts of a microservices stack fit together: service boundaries, an event bus, a gateway, orchestration and a deploy pipeline. It handles direct messages and group rooms, typing indicators, presence and last-seen, sent/delivered/seen receipts, room invitations and in-app notifications.

## Services

Each service owns its data store.

| Service | Port | Store | Role |
|---|---|---|---|
| user-service | 3001 | PostgreSQL (TypeORM) | Registration, login with JWT, profiles, login lockout |
| chat-service | 3002 | MongoDB (Mongoose) | Rooms, members, invitations, Socket.IO gateway |
| message-service | 3003 | MongoDB | Message storage, history pagination, read receipts |
| notification-service | 3004 | Redis | In-app notifications, unread counts |
| presence-service | 3005 | Redis | Online state and last-seen |

Ports are the host ports from `docker-compose.yml`. Services do not call each other over HTTP; they publish and consume events on RabbitMQ (`message.sent`, `invitation.received`, `room.created`, `messages.read`, `participants.changed`, `message.deleted`).

## How it works

**Gateway.** All outside traffic goes through NGINX (`gateway/nginx.conf`). It routes `/api/auth` and `/api/users` to user-service, `/api/rooms` and `/api/invitations` to chat-service, `/api/messages` to message-service, and so on, and sends `/socket.io/` upgrades to the right service based on the `nsp` query argument. Rate limits are 30 requests/s for the API and 5 requests/s for auth.

**Sending a message.**

1. The client emits `send_message` on the socket. The chat gateway checks the sender is in the room, caps the content at 4000 characters, and broadcasts `new_message` to the room straight away.
2. It then emits `message.create` on the bus. message-service saves it to MongoDB and emits `message.sent` to notification-service (for the unread badge) and back to chat-service.
3. Reading a room updates the `readBy` set and emits `messages.read`, which chat-service relays so other clients update their seen marks.

**Invitations.** Accepting an invite emits `invitation.accepted` and `room.created`. The chat gateway joins the participants' sockets to the new room and emits `room_created`, so their UIs update without a reload.

**Socket auth.** On connect the chat gateway verifies the JWT from the handshake auth payload or the `Authorization` header, then joins the socket to a per-user channel, an email channel (so invitations reach people who are not in the room yet) and each room the user belongs to.

**Auth.** Passwords are hashed with bcrypt at 12 rounds. Five failed logins lock the account for 15 minutes, and a successful login resets the counter. Services also use `helmet` and `@nestjs/throttler`.

**Observability.** Each service exposes `/metrics` (prom-client) and health checks (`@nestjs/terminus`). `monitoring/` has Prometheus, Grafana and a dashboard. Swagger UI is available per service.

**Frontend.** Next.js 16 with React 19 and the app router, Zustand stores (auth, chat, presence, theme, toast) and a Socket.IO client. Routes are split into `(auth)` (login, signup) and `(main)` (rooms, chat, settings). It has light, dark and system themes.

## CI/CD and deployment

`.github/workflows/ci.yml` runs on pushes to `main` and `develop` and on pull requests to `main`. It runs a matrix over the frontend and the five services on Node 22 (lint, build, unit tests) against Postgres, MongoDB, Redis and RabbitMQ service containers. `cd.yml` runs after a successful CI run on `main` and triggers Render deploy hooks for each service.

`k8s/` has a namespace, deployments and services for each component, PVCs for the databases and RabbitMQ, HPAs for chat-service and message-service, an ingress, configmaps and secrets.

`testing/` has k6 load and stress scripts, a Postman collection and a compose file for integration tests. No benchmark results are included.

## Stack

TypeScript, NestJS 11, Socket.IO, TypeORM, Mongoose, Passport JWT, PostgreSQL 16, MongoDB 7, Redis 7, RabbitMQ 3.13, NGINX, Next.js 16, React 19, Tailwind CSS, Zustand, Docker, Kubernetes, Prometheus, Grafana, GitHub Actions, Jest, k6.

## Setup

Needs Node.js 22+ and Docker with Compose. `kubectl` is only needed for the Kubernetes path.

```bash
git clone https://github.com/DCode-v05/Dispatch.git
cd Dispatch
cp .env.example .env
```

Edit `.env` and set at least `JWT_SECRET` and the database and broker passwords. Then:

```bash
docker compose up -d --build
```

`docker-compose.override.yml` is picked up automatically and runs each service with `start:dev` and your source mounted. The app is at http://localhost and the RabbitMQ console at http://localhost:15672.

To work on one service:

```bash
cd services/user-service
npm install
npm run start:dev
```

Monitoring and Kubernetes:

```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/
```

The values in `k8s/secrets/` are placeholders. Replace them before deploying anywhere real.

## Project structure

```
frontend/       Next.js app (src/app, components, stores, lib)
services/       user, chat, message, notification, presence services
gateway/        NGINX config and Dockerfile
k8s/            manifests: databases, services, hpa, ingress, configmaps, secrets, rabbitmq
monitoring/     Prometheus, Grafana, compose file
testing/        k6 scripts, Postman collection, integration compose
.github/        ci.yml and cd.yml
scripts/        run-in-each.js, runs an npm script in every package
```

The root `package.json` only sets up Husky and the `lint:all`, `build:all` and `test:all` scripts.

## Contact

Denistan B: [portfolio](https://www.denistan.me), [LinkedIn](https://www.linkedin.com/in/denistanb), denistanb05@gmail.com
