# Runbook — On-call & incident response

Operational guide for the realtime chat platform deployed on Render + MongoDB Atlas + CloudAMQP.
For initial deployment steps see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. Quick health snapshot

Before deep diving, run this Mac/Linux script (PowerShell variant below):

```bash
SERVICES=(user chat message notification presence)
for s in "${SERVICES[@]}"; do
  printf "%-12s " "$s"
  curl -sf -m 10 -o /dev/null -w "HTTP %{http_code} in %{time_total}s\n" \
    "https://chat-${s}-service-XXXX.onrender.com/health" || echo "DOWN"
done
```

```powershell
$services = @('user','chat','message','notification','presence')
foreach ($s in $services) {
  try {
    $r = Invoke-WebRequest -Uri "https://chat-$s-service-XXXX.onrender.com/health" -TimeoutSec 10
    Write-Host ("{0,-12} HTTP {1}" -f $s, $r.StatusCode)
  } catch {
    Write-Host ("{0,-12} DOWN" -f $s)
  }
}
```

A `200` means the service is up AND can reach its DB/broker. A `503` means the service is up but a dep is down — read the JSON `info.<dep>.message` field for details.

`GET /health/live` is a liveness-only check that returns 200 even when deps are down — useful for distinguishing "service crashed" from "service can't reach Postgres."

---

## 2. Common incidents

### 2.1 First request after idle takes ~30 seconds

**Symptom**: Frontend reports timeouts on first action after a quiet period.

**Cause**: Render free-tier dynos spin down after 15 minutes idle.

**Action**: Expected behavior. The frontend's axios client has a 35s timeout + retry-on-5xx interceptor, so the user-visible failure rate should be low. To eliminate it entirely, upgrade the affected service to a paid plan.

---

### 2.2 `/health` returns 503

**Symptom**: One or more services return 503 on `/health` but 200 on `/health/live`.

**Diagnostic**:
```bash
curl -s https://chat-XXX-service-XXXX.onrender.com/health | jq
```
The JSON's `info.<dep>` block tells you which dependency is failing (postgres / mongodb / redis).

**Fixes**:
- **Postgres**: Check the Render Postgres dashboard. **Free-tier Postgres expires after 30 days** — verify the database hasn't been auto-deleted. If it has, see §2.6.
- **MongoDB**: Check MongoDB Atlas. If the cluster shows network access issues, verify `0.0.0.0/0` is still in the IP allowlist.
- **Redis**: Check Render Key Value dashboard. Free tier has a 25 MB cap — see §2.5.

---

### 2.3 Login returns 401 "Invalid credentials" for known-good credentials

**Diagnostic checklist**:
1. Was the user previously locked? After 5 failed logins the account locks for 15 minutes. The response message will say "Account locked. Try again in N minute(s)."
2. Was JWT_SECRET rotated? If the user has an old token cached in their browser cookie, it'll be rejected. Have them log out and back in.
3. Are JWT_SECRETs identical across all 5 services? `chat-service` and `message-service` will reject tokens issued by `user-service` if they have different secrets.

**Resolution**:
- **To unlock an account manually**: connect to Render Postgres and run
  ```sql
  UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'user@example.com';
  ```
- **To rotate JWT_SECRET safely**: update on all 5 services simultaneously (or accept a window where active sessions are forcibly logged out). Render triggers a redeploy per service when env vars change.

---

### 2.4 RabbitMQ queue backlog (notifications/messages not arriving)

**Symptom**: Messages appear instantly in chat but no notification is delivered. Users report missed presence updates.

**Diagnostic**: Log into CloudAMQP console → RabbitMQ Management UI → check queue depths.

**Likely causes**:
- A consumer service (notification-service / chat-service / message-service) is down or stuck — restart it on Render.
- Free CloudAMQP plan limits: 1M messages/month, 20 connections, 100 queues. If you've hit a limit, queues will reject new messages.
- A poison message — see if one specific queue keeps growing. Bad payloads are now `nack`'d without requeue in the notification-service consumer, so they should not loop forever. If they are looping, deploy a hotfix.

**Recovery**:
- Restart the consumer (Render → service → Manual Deploy).
- For an unbounded backlog, purge the queue via the RabbitMQ management UI as a last resort: `Queues → <queue-name> → Purge Messages`. Note this **drops the messages** — only do this if the consumer code is broken.

---

### 2.5 Redis hit the 25 MB cap (free tier)

**Symptom**: Notification list operations start failing with `OOM command not allowed`, or presence data goes missing. Service logs show ioredis errors.

**Diagnostic**: Render Key Value dashboard → Metrics → Memory usage.

**Resolution**:
1. Reduce per-user notification retention (currently 100 items per user with 30-day TTL). Lower MAX_NOTIFICATIONS_PER_USER in `services/notification-service/src/notification.service.ts`.
2. If presence keys are bloating: their TTL is 90s — if you see >1MB of `presence:*` keys, you have a heartbeat-bug somewhere. Check that disconnections are firing properly.
3. Free-tier policy is `allkeys-lru` so the cache will evict cold data automatically. If hot data is being evicted, upgrade to a paid plan.

---

### 2.6 Render Postgres expired (30-day free-tier auto-delete)

**Symptom**: user-service starts returning 503. Health check shows `postgres` dependency is `down` with DNS error.

**Resolution**:
1. **Restore from backup** if you set up the weekly `pg_dump` job in [DEPLOYMENT.md §11](DEPLOYMENT.md#11-backups--disaster-recovery): download the latest artifact, create a new Render Postgres, restore via `psql "$URL" < backup.sql`.
2. **If no backup**: create a new Render Postgres. Users will need to re-register. Update all backend services' `POSTGRES_*` env vars and redeploy.
3. Inform stakeholders. Update DEPLOYMENT.md §12 with the new internal hostname.

**Prevention**: schedule a calendar reminder for day 25 of each Postgres rotation, or upgrade to a paid plan.

---

### 2.7 Frontend shows blank page / CORS errors

**Symptom**: Browser console shows `Access-Control-Allow-Origin` errors or `net::ERR_CONNECTION_REFUSED`.

**Cause**: `FRONTEND_URL` on one of the backend services doesn't exactly match the frontend's origin.

**Fix**:
- Confirm the frontend URL exactly (including `https://` and no trailing slash).
- Set `FRONTEND_URL` to that exact value on **all 5 backend services**.
- Each service auto-redeploys when the env var changes.

If the frontend itself fails to load with no errors, check the Render frontend logs — likely Next.js standalone server didn't start because `HOSTNAME` isn't `0.0.0.0`.

---

### 2.8 WebSocket disconnects every ~30 seconds

**Symptom**: Real-time chat works for ~30s then drops, reconnects, drops again.

**Likely causes**:
- Render free tier kills idle WebSockets after 60s if no activity. Make sure presence-service is sending heartbeats from the client (it does, but verify in DevTools).
- The frontend Socket.IO client has 10 reconnect attempts with exponential backoff (500ms → 8s). If reconnect storms occur, that's the source — investigate the underlying drop.
- CloudAMQP free plan has 20-connection limit. If you saw bursty traffic, services may have queued up RabbitMQ connections, exhausting the cap. Check the CloudAMQP console.

**Diagnostic**: Browser DevTools → Network tab → WS → look for the `socket.io` connection. If it shows `1006 Abnormal Closure` immediately after handshake, JWT verification failed — check that the user's token isn't expired (24h default lifetime).

---

### 2.9 5xx errors spike

**Steps**:
1. Identify which service: Render dashboard → each service → Metrics (or hit each `/health` per §1).
2. Pull logs: Render → affected service → Logs tab → filter for `ERROR`.
3. Look for the structured exception filter output. Each error includes a `requestId` you can grep for to follow it across services.
4. If a specific endpoint is breaking, check the corresponding controller and `@nestjs/throttler` config — could be rate-limited at 429.

---

### 2.10 High latency (p95 > 1s) on previously fast endpoints

**Likely causes**:
- A dependency (DB/Redis/Mongo) is slow. Check Render metrics + Atlas / Render dashboards.
- Connection pool exhausted. Look in logs for `Connection pool exhausted` or `idle_in_transaction_session_timeout`. Tune `POSTGRES_POOL_MAX` / `MONGODB_POOL_MAX` env vars.
- Cold start. See §2.1.
- Memory pressure. Render free tier gives 512 MB RAM. Check Render → service → Metrics → Memory. Restart if near the cap.

If you have Prometheus + Grafana attached, check the `http_request_duration_seconds` histogram per service to localize.

---

## 3. Rotating JWT secrets

JWT_SECRET is identical across all 5 services. To rotate:

1. Generate a new 32-byte hex secret locally (see [DEPLOYMENT.md](DEPLOYMENT.md#common-environment-variables)).
2. Update `JWT_SECRET` env var on **all 5 services** in the Render dashboard, ideally within a few minutes of each other.
3. Each service auto-restarts. Existing user tokens become invalid — affected users will see a 401 on their next request and be redirected to `/login`.

**Warning**: there's no graceful overlap. If you need zero-downtime rotation, you'll need to support a `JWT_SECRET_PREV` env var and try-then-fallback verification — currently not implemented.

---

## 4. Forcing a fresh frontend deploy

`NEXT_PUBLIC_*` vars are inlined at build time. If you change any service URL:

1. Update the env var on the `chat-frontend` service.
2. Render dashboard → frontend → **Manual Deploy → Clear build cache & deploy**.
3. Without "Clear build cache", Render may reuse the old bundle and you'll see stale URLs.

---

## 5. Restarting a service

Render dashboard → service → top-right menu → **Restart Service**. This causes a 5–10s gap in availability. Active WebSockets will be dropped and clients will reconnect.

---

## 6. Looking up logs by user / request ID

Every HTTP response now includes an `x-request-id` header. To trace one user's session across services:

1. Grab the `x-request-id` from the browser's failing request (DevTools → Network → Headers).
2. Search Render logs (all 5 services) for that ID. Logs are JSON; the field is `requestId`.

The request ID is propagated to all RabbitMQ events emitted within that HTTP handler, so you can follow it through async paths too (though only HTTP entry points generate new IDs).

---

## 7. Locking yourself out (emergency)

If you accidentally locked the only admin account through repeated failed logins, **and there is no admin user role yet** (true today), connect to Postgres directly:

```bash
psql "$RENDER_POSTGRES_EXTERNAL_URL"
```

```sql
UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'you@example.com';
```

Use the **external** Postgres URL, not the internal one — internal URLs only resolve from inside the Render network.

---

## 8. Escalation

If an incident is beyond this runbook:
1. Render status: https://status.render.com
2. CloudAMQP status: https://status.cloudamqp.com
3. MongoDB Atlas status: https://status.mongodb.com
4. GitHub Actions status: https://www.githubstatus.com

For data integrity questions, take a `pg_dump` and `mongodump` BEFORE attempting fixes, even if it adds 5 minutes — recovery from a worse state is much more expensive.
