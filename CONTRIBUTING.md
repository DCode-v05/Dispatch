# Contributing

Welcome. This document covers the local dev loop, conventions, and how to extend the platform.

For deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).
For on-call response, see [RUNBOOK.md](RUNBOOK.md).

---

## 1. Prerequisites

- Node.js **22.11** (matches the Docker base image; nvm: `nvm use 22.11`)
- Docker Desktop or compatible (Podman, Rancher, etc.)
- Git

---

## 2. First-time setup

```bash
git clone <repo-url>
cd realtime-chat-microservices

# Install root tooling (Husky pre-commit hooks)
npm install

# Copy and edit env vars
cp .env.example .env
# Generate a real JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste into .env as JWT_SECRET
```

---

## 3. Running locally

```bash
# All services + dbs + broker
docker compose up --build

# Or only the infra and run services natively for fast iteration:
docker compose up postgres mongodb redis rabbitmq
# then in separate terminals:
cd services/user-service && npm install && npm run start:dev
cd services/chat-service && npm install && npm run start:dev
# ...etc
```

Service URLs once docker-compose is up:
- Gateway: http://localhost:80
- Swagger docs: http://localhost:3001/docs (user), :3002, :3003, :3004, :3005
- Frontend: http://localhost:3000
- RabbitMQ UI: http://localhost:15672 (chatadmin / chatpass123)
- Prometheus: http://localhost:9090 (if you bring up monitoring/docker-compose.monitoring.yml)
- Grafana: http://localhost:3100 (admin / admin)

---

## 4. Project layout

```
.
├── frontend/                     Next.js client
├── services/
│   ├── user-service/             Postgres-backed: auth, profiles
│   ├── chat-service/             Mongo-backed: rooms, invitations, /chat WS
│   ├── message-service/          Mongo-backed: persistence, history
│   ├── notification-service/     Redis-backed: notifications, /notifications WS
│   └── presence-service/         Redis-backed: online status, /presence WS
├── gateway/                      Nginx reverse proxy (used by docker-compose + k8s)
├── k8s/                          Kubernetes manifests (alt deployment target)
├── monitoring/                   Prometheus + Grafana
├── testing/                      Integration / load tests
├── .github/workflows/            CI + CD
├── DEPLOYMENT.md
├── RUNBOOK.md
└── README.md
```

Each backend service follows the same skeleton:
```
services/<svc>/src/
├── main.ts                       bootstrap, helmet, validation, shutdown, Swagger
├── app.module.ts                 wires modules + ThrottlerGuard + RequestIdMiddleware
├── common/
│   ├── env.validation.ts         fail-fast env checks (required vars + prod rules)
│   ├── all-exceptions.filter.ts  global error filter with structured logging
│   ├── request-id.middleware.ts  x-request-id propagation
│   ├── metrics.module.ts         /metrics (Prometheus) + HTTP duration histogram
│   ├── redis.provider.ts         (notification + presence only)
│   └── redis-health.indicator.ts (notification + presence only)
└── health/                       /health (terminus-backed) + /health/live
```

---

## 5. Conventions

### Errors
- Throw NestJS exceptions (`BadRequestException`, `ForbiddenException`, etc.) rather than custom Error subclasses. The `AllExceptionsFilter` formats them consistently.
- Never `console.log` in services — use `new Logger(MyClass.name)` so output is structured and respects log levels.

### Validation
- All DTOs use class-validator decorators.
- Add `@ApiProperty()` to DTO fields so Swagger UI shows accurate examples.

### Auth
- HTTP endpoints: `@UseGuards(JwtAuthGuard)` and read `req.user.userId` / `req.user.email`.
- WebSocket gateways: extract token from `client.handshake.auth.token` and verify with `JwtService` inside `handleConnection`. Emit `unauthorized` and `client.disconnect(true)` on failure.

### Inter-service comms
- Async events go through RabbitMQ (`@EventPattern('...')`).
- All event handlers in `notification-service` use the `ackOrNack(context, success)` helper so failures `nack` without requeue (no poison-message loops).
- Outbound `client.emit(...)` calls should be wrapped in `safeEmit` so a broker outage doesn't break the request — they will retry through the broker's own queueing.

### Database access
- **chat-service** owns the `chatrooms` and `invitations` collections.
- **message-service** owns the `messages` collection but reads `chatrooms` via the lightweight `ChatRoomRead` schema for participant verification.
- Add indexes when introducing new query patterns. See [chat-room.schema.ts](services/chat-service/src/schemas/chat-room.schema.ts).

### Env vars
- Add new required vars to the service's `common/env.validation.ts` so the service fails at boot if missing in production.
- Add to `.env.example` with `REPLACE_ME` placeholders for secrets.
- Update [DEPLOYMENT.md](DEPLOYMENT.md) so the next deployer knows.

---

## 6. Adding an endpoint

1. Add a DTO with `class-validator` decorators in `src/<feature>/dto/`.
2. Add a controller method:
   ```ts
   @ApiTags('feature')
   @UseGuards(JwtAuthGuard)
   @Post('thing')
   async create(@Body() dto: CreateThingDto, @Request() req: AuthenticatedRequest) {
     return this.thingService.create(dto, req.user.userId);
   }
   ```
3. Implement the service method — push all logic out of the controller.
4. Add a unit test next to the service (`thing.service.spec.ts`).
5. Verify Swagger picks it up at `/docs`.

## 7. Adding a RabbitMQ event

1. Decide the event name (`<noun>.<past-tense-verb>`, e.g., `room.deleted`).
2. **Producer side**: call `this.safeEmit(this.client, 'room.deleted', { ... })`.
3. **Consumer side**: in the consuming service's controller, add
   ```ts
   @EventPattern('room.deleted')
   async handleRoomDeleted(@Payload() data: { ... }, @Ctx() ctx: RmqContext) {
     try {
       // ... do work
       ackOrNack(ctx, true);
     } catch (err) {
       this.logger.error(`handleRoomDeleted failed: ${err}`);
       ackOrNack(ctx, false);  // poison messages won't loop
     }
   }
   ```
4. Ensure the consuming service is bound to the queue the producer is publishing to (check `main.ts` `connectMicroservice`).

## 8. Adding a new microservice

If you need a 6th service:
1. Copy `services/notification-service` as a starting template (closest to a generic service).
2. Rename in `package.json`, `src/main.ts` (Swagger title + queue name), `src/common/env.validation.ts` (service prefix in error messages).
3. Add to:
   - `docker-compose.yml`
   - `.github/workflows/ci.yml` matrix
   - `.github/workflows/cd.yml` deploy-hook list
   - [DEPLOYMENT.md](DEPLOYMENT.md) §5 (Render service settings)
   - [RUNBOOK.md](RUNBOOK.md) §1 health-check script
   - `scripts/run-in-each.js` workspaces list
   - `.husky/pre-commit` services list
4. If the new service needs to receive events, give it a unique `queue` name in `main.ts`.

## 9. Testing

```bash
# Per-service unit tests
cd services/user-service && npm test

# Per-service e2e tests
cd services/user-service && npm run test:e2e

# Everything
npm run test:all
```

- Unit tests live next to the file under test (`*.spec.ts`).
- E2E tests live in `services/*/test/*.e2e-spec.ts` and use Nest's testing module.
- Mock external deps (DB, Redis, RabbitMQ ClientProxy) at the provider level — never hit real services in unit tests.

## 10. Pre-commit & CI

The repo has a Husky pre-commit hook that runs lint on every workspace touched by your staged changes. To skip it (use sparingly): `git commit --no-verify`.

CI runs on every push and PR:
- Lint
- Build (acts as type-check)
- Unit tests
- `npm audit --audit-level=high` (non-fatal)
- Docker image build & push on `main`
- Trivy security scan (non-fatal)

CD fires automatically after CI passes on `main`, hitting Render's deploy hooks. See [DEPLOYMENT.md §8](DEPLOYMENT.md#8-cicd-setup).

## 11. Commit conventions

No strict format required, but please:
- Use present tense ("add feature" not "added feature").
- Keep the subject line under ~70 characters.
- Reference an issue when relevant.

## 12. Code style

- ESLint + Prettier are configured per workspace. The pre-commit hook auto-fixes formatting via `eslint --fix`.
- Avoid `any` — use `unknown` and narrow.
- Prefer composition over inheritance. Prefer many small focused services over one large module.

---

Questions? Open a discussion or issue.
