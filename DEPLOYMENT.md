# Deployment Guide — Render + MongoDB Atlas + CloudAMQP

Complete walkthrough for deploying this microservices chat platform to a free-tier cloud stack.

## Stack overview

| Component | Where it runs | Why |
|---|---|---|
| Frontend (Next.js) | Render Web Service (Docker) | Standalone server with WebSocket support |
| 5 NestJS services | Render Web Services (Docker) | Long-running HTTP + Socket.IO |
| PostgreSQL | Render Managed Postgres | User auth data |
| Redis / Valkey | Render Key Value | Notifications + presence |
| MongoDB | MongoDB Atlas (M0 free) | Chat rooms + messages |
| RabbitMQ | CloudAMQP (Little Lemur free) | Inter-service event bus |
| CI/CD | GitHub Actions + Render auto-deploy | Test on push, deploy on success |

### Free-tier caveats

- Render free Web Services spin down after 15 min idle (~30s cold start on next request)
- Render free Postgres expires after 30 days (must recreate)
- Render free Key Value: 25 MB
- MongoDB Atlas M0: 512 MB
- CloudAMQP Little Lemur: 1M messages/month, 20 connections, 100 queues

For a demo this works. For sustained use plan ~$7/service/month.

---

## 1. Prerequisites

- GitHub repo with this codebase pushed to `main`
- Accounts on:
  - [render.com](https://render.com) (sign in with GitHub)
  - [cloud.mongodb.com](https://cloud.mongodb.com)
  - [cloudamqp.com](https://cloudamqp.com)

---

## 2. Provision MongoDB Atlas

1. Create a free **M0** cluster — pick a region close to your Render region
2. **Database Access** → Add Database User
   - Username: `chatadmin`
   - Password: **Generate alphanumeric-only** (no `@`, `:`, `/`, `%`, `?` etc.) — special chars require URL encoding and cause connection bugs
   - Built-in Role: `Read and write to any database`
3. **Network Access** → IP Access List → Add `0.0.0.0/0`
   - Required because Render free-tier service IPs are dynamic
4. **Connect** → "Drivers" → copy the connection string, then replace `<password>` and add the database name:
   ```
   mongodb+srv://chatadmin:<PASSWORD>@<CLUSTER>.mongodb.net/chatplatform?retryWrites=true&w=majority
   ```

### Common Atlas pitfalls

- **`mongodb+srv` URIs cannot have a port number** — the SRV DNS record provides the port automatically
- If your password has special characters, URL-encode only the password portion — the `@` between password and host must stay literal
- Don't forget `/chatplatform` before `?` or Mongoose will use the default `test` database

---

## 3. Provision CloudAMQP

1. Create instance → **Little Lemur (free)** plan
2. Pick the same region family as Render if possible
3. Open the instance → **AMQP Details** → copy the **URL**:
   ```
   amqps://<user>:<pass>@<host>.cloudamqp.com/<vhost>
   ```

Note the `amqps://` (TLS) — CloudAMQP requires it. The same URL is used by all 5 services.

---

## 4. Provision Render databases

In the Render dashboard, click **New +** for each:

### PostgreSQL

- Name: `chat-postgres`
- Database: `chatplatform`
- User: `chatadmin`
- Region: pick one (e.g. Oregon) — **all subsequent services must use this same region**
- Plan: Free

After creation, on the database's page, copy the **Internal Database URL** (looks like `postgresql://chatadmin:xxx@dpg-xxxx-a/chatplatform`).

Extract the parts for env vars:
- `POSTGRES_HOST` = the part between `@` and `/` (e.g. `dpg-xxxx-a`)
- `POSTGRES_PORT` = `5432`
- `POSTGRES_USER` = `chatadmin`
- `POSTGRES_PASSWORD` = from the dashboard
- `POSTGRES_DB` = `chatplatform`

### Key Value (Redis-compatible)

- Name: `chat-redis`
- Region: **same as Postgres**
- Plan: Free
- Maxmemory Policy: `allkeys-lru`

After creation, copy the **Internal Redis URL** (`redis://red-xxxx:6379`). Extract:
- `REDIS_HOST` = the part between `redis://` and `:6379` (e.g. `red-xxxx`)
- `REDIS_PORT` = `6379`
- `REDIS_PASSWORD` = leave blank (Render free Key Value has no password)

**Important:** Internal URLs only resolve **service-to-service within the same region on Render**. Mixing regions causes `ENOTFOUND` errors.

---

## 5. Deploy the 5 NestJS services

Repeat for each of: `user-service`, `chat-service`, `message-service`, `notification-service`, `presence-service`.

### Common settings (all services)

| Field | Value |
|---|---|
| Source | Your GitHub repo |
| Branch | `main` |
| Runtime | **Docker** |
| Region | Same as Postgres + Redis |
| Plan | Free |
| Health Check Path | `/health` |
| Auto-Deploy | Yes / On Commit |

### Common environment variables

```
PORT          = 3000
NODE_ENV      = production                     ← required; enables prod logging + disables TypeORM auto-sync
JWT_SECRET    = <random 32+ char hex>          ← MUST be identical across all 5 services
                                                  Services hard-fail at boot if missing or shorter than 32 chars in prod.
RABBITMQ_URL  = amqps://...                    ← from CloudAMQP (must be amqps:// for TLS)
FRONTEND_URL  = https://chat-frontend-xxxx.onrender.com   ← set after frontend is deployed
                                                            Must be https:// — services reject http:// in prod.
                                                            Comma-separate to allow multiple origins.
```

Generate JWT_SECRET locally with:
```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Or on macOS/Linux:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional tuning vars (sensible defaults provided)

```
POSTGRES_POOL_MAX   = 5      # user-service connection pool size
POSTGRES_SSL        = true   # set if your Postgres requires TLS
MONGODB_POOL_MAX    = 10     # chat-service + message-service mongoose pool
```

### Per-service settings

#### chat-user-service

- **Root Directory**: `services/user-service`
- **Extra env vars**:
  ```
  POSTGRES_HOST     = dpg-xxxx-a
  POSTGRES_PORT     = 5432
  POSTGRES_USER     = chatadmin
  POSTGRES_PASSWORD = <from Render Postgres>
  POSTGRES_DB       = chatplatform
  ```

#### chat-chat-service

- **Root Directory**: `services/chat-service`
- **Extra env vars**:
  ```
  MONGODB_URI = mongodb+srv://chatadmin:<pw>@cluster.mongodb.net/chatplatform?retryWrites=true&w=majority
  ```
- This service hosts Socket.IO — clients connect to it directly for the `/chat` namespace

#### chat-message-service

- **Root Directory**: `services/message-service`
- **Extra env vars**: same `MONGODB_URI` as chat-service

#### chat-notification-service

- **Root Directory**: `services/notification-service`
- **Extra env vars**:
  ```
  REDIS_HOST     = red-xxxx
  REDIS_PORT     = 6379
  REDIS_PASSWORD =
  ```

#### chat-presence-service

- **Root Directory**: `services/presence-service`
- **Extra env vars**: same Redis vars as notification-service

After all 5 deploy successfully, note each service's URL — you'll need them for the frontend.

---

## 6. Deploy the frontend

This project uses Next.js with `output: 'standalone'` so the API/WS URLs must be baked into the bundle at **build time**.

### Service settings

| Field | Value |
|---|---|
| Name | `chat-frontend` |
| Root Directory | `frontend` |
| Runtime | Docker |
| Plan | Free |
| Health Check Path | `/` |

### Build-time + runtime env vars

Render passes dashboard env vars as `--build-arg` to Docker builds when matching `ARG`s exist in the Dockerfile (already configured in `frontend/Dockerfile`).

```
PORT                      = 3000
HOSTNAME                  = 0.0.0.0           ← required for Next.js standalone to accept external traffic

NEXT_PUBLIC_USER_URL      = https://chat-user-service-xxxx.onrender.com
NEXT_PUBLIC_CHAT_URL      = https://chat-chat-service-xxxx.onrender.com
NEXT_PUBLIC_MESSAGE_URL   = https://chat-message-service-xxxx.onrender.com
NEXT_PUBLIC_NOTIF_URL     = https://chat-notification-service-xxxx.onrender.com
NEXT_PUBLIC_PRESENCE_URL  = https://chat-presence-service-xxxx.onrender.com

NEXT_PUBLIC_CHAT_WS       = https://chat-chat-service-xxxx.onrender.com
NEXT_PUBLIC_PRESENCE_WS   = https://chat-presence-service-xxxx.onrender.com
NEXT_PUBLIC_NOTIF_WS      = https://chat-notification-service-xxxx.onrender.com
```

⚠️ `NEXT_PUBLIC_*` vars are **inlined at build time**. If you change them later, click **Manual Deploy → Clear build cache & deploy** — otherwise Render reuses the old bundle.

### After deploy

Copy the frontend URL (e.g. `https://chat-frontend-xxxx.onrender.com`) and **set `FRONTEND_URL` on all 5 backend services** to that exact value (no trailing slash, must be `https://`). Each service will auto-redeploy with the new CORS origin.

---

## 7. Verification

### Health checks

```powershell
curl https://chat-user-service-xxxx.onrender.com/health
curl https://chat-chat-service-xxxx.onrender.com/health
curl https://chat-message-service-xxxx.onrender.com/health
curl https://chat-notification-service-xxxx.onrender.com/health
curl https://chat-presence-service-xxxx.onrender.com/health
```

Each should return `200 OK` with JSON like `{ "status": "ok", "info": { "postgres": {...} } }`. The `/health` endpoint now actually pings the underlying DB/Redis — a `503` means the database is unreachable, not just that the service is up.

There's also `/health/live` (no dep check, just process liveness) — useful for Render's health check setting since it returns 200 even during DB outages, avoiding restart loops.

First request to any service may take ~30s if the dyno is cold.

### End-to-end flow

1. Open the frontend URL
2. DevTools → **Network** tab
3. Sign up → request should hit `chat-user-service-xxxx.onrender.com/auth/register`
4. Login → cookie set, navigate to chat
5. Open a room → WebSocket connects to `chat-chat-service-xxxx.onrender.com/socket.io/?EIO=4&...`
6. Send a message → appears in real time

---

## 8. CI/CD setup

### GitHub Actions CI

`.github/workflows/ci.yml` already configured. Runs on every push to `main`:
- Lints and tests all 6 codebases in parallel
- Builds Docker images and pushes to GitHub Container Registry (ghcr.io)

No setup needed beyond pushing to GitHub.

### Render auto-deploy

Two options:

**Option A — Render native auto-deploy (simpler)**

Per service → Settings → Auto-Deploy: **Yes** / **On Commit**.

Render watches the repo for pushes and rebuilds when files in the service's Root Directory change.

**Prerequisite:** the Render GitHub App must be installed on your GitHub account with access to this repo:
1. Go to https://github.com/apps/render → Install
2. Select your account and grant access to `Real-Time-Chat`
3. In Render Account Settings → GitHub, verify the repo appears in "Repositories you have access to"

**Option B — Deploy Hooks (via CI gate)**

Use this if you want deploys gated on CI passing:

1. Per service → Settings → scroll to **Deploy Hook** → copy the URL
2. GitHub repo → Settings → Secrets and variables → Actions → add:
   ```
   RENDER_USER_HOOK         = <url>
   RENDER_CHAT_HOOK         = <url>
   RENDER_MESSAGE_HOOK      = <url>
   RENDER_NOTIF_HOOK        = <url>
   RENDER_PRESENCE_HOOK     = <url>
   RENDER_FRONTEND_HOOK     = <url>
   ```
3. Set Render Auto-Deploy to **No** (so only CD triggers deploys)
4. `.github/workflows/cd.yml` (already configured) will hit each hook after CI passes

---

## 9. Architecture (deployed)

```
                                                  ┌─────────────────┐
Browser                                           │ MongoDB Atlas   │
   │                                              │  (M0 free)      │
   │  HTTPS + WSS                                 └────────▲────────┘
   │                                                       │
   ├──────────────► chat-user-service       ──► PostgreSQL (Render)
   │                                                       │
   ├──────────────► chat-chat-service       ──► MongoDB ◄──┤
   │                                                       │
   ├──────────────► chat-message-service    ──► MongoDB ◄──┘
   │
   ├──────────────► chat-notification-service ──► Redis (Render)
   │
   └──────────────► chat-presence-service     ──► Redis (Render)

                            ▲
                            │
                            │  amqps://
                            │
                    ┌───────┴───────┐
                    │   CloudAMQP   │
                    │  (RabbitMQ)   │
                    └───────────────┘
```

All services communicate via RabbitMQ for events (`user.created`, `message.sent`, etc.) and call each other's HTTP APIs only when needed. There's no API gateway in this deployment — the frontend calls each service directly using URL-based routing in `frontend/src/lib/api.ts`.

---

## 10. Troubleshooting

### MongoDB connection errors

| Error | Cause | Fix |
|---|---|---|
| `querySrv ENOTFOUND _mongodb._tcp.05` | Password has unencoded special char | Regenerate as alphanumeric-only |
| `MongoParseError: mongodb+srv URI cannot have port number` | URI contains `:27017` | Remove the port — SRV provides it |
| `Authentication failed` | Wrong password or user not in Atlas Database Access | Re-check Atlas Database Access tab |
| `MongoServerSelectionError: connection timed out` | Atlas IP allowlist doesn't include 0.0.0.0/0 | Add it under Network Access |

### Redis connection errors

| Error | Cause | Fix |
|---|---|---|
| `getaddrinfo ENOTFOUND red-xxxx:6379` | Wrong host OR region mismatch | Verify hostname; confirm service & Redis are in same Render region |
| `ENOTFOUND red-xxxx.oregon-postgres.render.com` | Pasted external URL instead of internal | Use the **Internal Redis URL** from Render |
| `NOAUTH Authentication required` | Set `REDIS_PASSWORD` on a Key Value that doesn't have one | Clear the env var |

### Frontend returns 502

- Next.js standalone defaults to binding `localhost` — Render can't reach it
- Fix: set `HOSTNAME=0.0.0.0` (already in `frontend/Dockerfile`)
- If still failing, check `chat-frontend` Logs tab for build errors

### Frontend calls `http://localhost/api/...`

- `NEXT_PUBLIC_*` env vars weren't picked up at build time
- Fix: Render → service → Manual Deploy → **Clear build cache & deploy**
- Verify all 8 `NEXT_PUBLIC_*` vars are set before the build runs

### CORS errors in browser

```
Access to XMLHttpRequest at 'https://chat-xxx-service-xxx.onrender.com'
from origin 'https://chat-frontend-xxx.onrender.com' has been blocked by CORS policy
```

- `FRONTEND_URL` env var on the service doesn't exactly match the frontend's origin
- Must be `https://` (not `http://`)
- No trailing slash
- Update env var → service auto-redeploys

### Render auto-deploy doesn't fire on push

1. Verify the commit reached `origin/main`: `git log origin/main -1`
2. GitHub → Settings → Applications → Installed GitHub Apps → Render → Configure → ensure `Real-Time-Chat` is in allowed repos
3. Render → service → Settings → Auto-Deploy = Yes / On Commit
4. Render → service → Settings → Branch = `main`
5. Last resort: use Deploy Hooks (see CI/CD section, Option B)

### "After CI Checks Pass" mode never deploys

Render needs to know which checks to wait for. Click **Edit** next to the dropdown and select the CI workflow checks. Without this configuration, Render waits indefinitely.

### Service shows "Deployed" but `/health` returns 502

- Service crashed during startup (likely a connection error)
- Render → service → **Logs** tab → look for the actual exception
- Most common: bad MongoDB URI or Redis hostname

### Service crashes at boot with "Missing required env vars"

The hardening pass added strict env validation. Each service hard-fails on boot if any required var is missing or invalid. Read the message — it lists exactly which vars are missing for which service.

Common cases:
- `JWT_SECRET is set to a known default value` — you copied `.env.example` literally. Regenerate.
- `JWT_SECRET must be at least 32 characters in production` — your secret is too short. Regenerate with the command above.
- `FRONTEND_URL must be set to an https:// origin in production` — you set it to `http://...` or to a Render preview URL without `https://`. Fix to the exact frontend origin.

### Service crashes at boot with "Cannot connect to RabbitMQ" / "MongoServerSelectionError"

Connection retries are bounded. If the broker/DB URL is wrong, the service exits rather than spinning forever. Verify URLs in env vars, then redeploy.

### Login returns 429

The auth endpoints are rate-limited: 10 logins/min and 5 registrations/min per IP. This is to slow brute-force attacks. Repeated bad passwords also lock the account for 15 minutes after 5 failures — wait or log in correctly.

### Register returns 400 with password rules

The hardening pass introduced password requirements: at least 8 chars, with one uppercase, one lowercase, and one digit. Usernames are 3–32 chars and may only contain letters, numbers, `_`, `.`, `-`.

---

## 11. Backups & disaster recovery

Render free tier has limited backup support. Plan accordingly.

| Resource | Backup option | RTO/RPO |
|---|---|---|
| Render free Postgres | **Expires after 30 days, no auto-backup.** Use `pg_dump` on a schedule (e.g. weekly GitHub Action) to dump to a private S3 bucket or GitHub Artifacts. | Hours / 1 week |
| Render free Key Value | **No backup.** Treat as ephemeral (presence + transient notifications). | N/A |
| MongoDB Atlas M0 | **No PITR**, but Atlas keeps recent snapshots you can manually restore from. Schedule `mongodump` weekly for off-cluster backups. | Hours / 1 week |
| CloudAMQP Little Lemur | **No backup needed** — queues are transient. Make sure consumers can re-process events idempotently. |  |

### Recommended `pg_dump` GitHub Action snippet

```yaml
name: Weekly Postgres Backup
on:
  schedule:
    - cron: '0 3 * * 0'  # Sundays at 03:00 UTC
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install pg_dump
        run: sudo apt-get install -y postgresql-client
      - name: Dump
        env:
          DATABASE_URL: ${{ secrets.RENDER_POSTGRES_EXTERNAL_URL }}
        run: pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip > backup.sql.gz
      - uses: actions/upload-artifact@v4
        with:
          name: pg-backup-${{ github.run_id }}
          path: backup.sql.gz
          retention-days: 90
```

Use the **External Database URL** from Render (not the internal one) since this runs outside Render's network.

### Restore steps

1. Spin up a fresh Render Postgres (if the old one expired).
2. Download the artifact, decompress, and `psql "$NEW_URL" < backup.sql`.
3. Update each backend service's Postgres env vars and redeploy.

---

## 12. URLs reference (fill in after deploying)

Keep this table updated for your team:

| Service | URL |
|---|---|
| Frontend | https://chat-frontend-XXXX.onrender.com |
| User Service | https://chat-user-service-XXXX.onrender.com |
| Chat Service | https://chat-chat-service-XXXX.onrender.com |
| Message Service | https://chat-message-service-XXXX.onrender.com |
| Notification Service | https://chat-notification-service-XXXX.onrender.com |
| Presence Service | https://chat-presence-service-XXXX.onrender.com |
| Postgres (internal) | dpg-XXXX-a |
| Redis (internal) | red-XXXX |
| MongoDB Atlas | XXXX.mongodb.net |
| CloudAMQP | XXXX.cloudamqp.com |

---

## 13. Deployment order (cheat sheet)

```
1. MongoDB Atlas    → get connection string
2. CloudAMQP        → get AMQP URL
3. Render Postgres  → note internal URL
4. Render Key Value → note internal URL
5. 5 NestJS services (parallel)
6. Frontend service (after services have URLs)
7. Set FRONTEND_URL on all 5 services (CORS)
8. Verify end-to-end
```

Total time: ~45 min if env vars are prepared in advance. First build per service ~5–8 min; subsequent builds ~2 min with cache.
