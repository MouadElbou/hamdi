# Deployment & Go-Live Runbook

Production deployment for the stock-platform backend (Fastify + Prisma + Postgres).
The desktop apps sync to this backend over HTTPS.

> Money is stored in **centimes** (integer). Nothing in this runbook changes that.

---

## 1. Required environment variables

Set these in the host environment or a root `.env` next to `docker-compose.yml`
(Compose reads `.env` automatically). There are **no insecure defaults** — unset
secrets make the stack fail to start, by design.

| Variable             | Required | Notes                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`  | yes      | Postgres superuser password. No default; stack refuses to start.      |
| `POSTGRES_USER`      | no       | Defaults to `postgres`.                                               |
| `POSTGRES_DB`        | no       | Defaults to `stock_platform`.                                        |
| `JWT_SECRET`         | yes      | >= 32 chars, not the placeholder. Generate with `openssl rand -hex 32`.|
| `API_KEY`            | yes      | >= 32 chars, not the placeholder. Generate with `openssl rand -hex 32`.|
| `CORS_ORIGINS`       | no       | Comma-separated allowed origins. Defaults to `http://localhost:3000`. |
| `SYNC_DOMAIN`        | TLS only | Public hostname Caddy serves (e.g. `sync.myshop.ma`).                 |
| `ACME_EMAIL`         | no       | Email for Let's Encrypt expiry notices.                              |
| `NEXT_PUBLIC_STORE_PHONE` | no  | Storefront phone; has a default.                                     |

`DATABASE_URL` is assembled inside Compose from `POSTGRES_USER` / `POSTGRES_PASSWORD`
/ `POSTGRES_DB`. You only set `DATABASE_URL` directly when running the backend
**outside** Docker (see `.env.example`).

### Generating secrets

```bash
# Run twice — one value for JWT_SECRET, one for API_KEY.
openssl rand -hex 32
```

The backend validates these at startup in production: empty, the literal
`change-me-in-production`, or anything shorter than 32 chars causes a
`FATAL` log and `exit(1)`.

---

## 2. First-time go-live

```bash
# 1. Create the root .env with the secrets above.
cat > .env <<'EOF'
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<openssl rand -hex 32 output>
API_KEY=<openssl rand -hex 32 output>
CORS_ORIGINS=https://admin.myshop.ma
SYNC_DOMAIN=sync.myshop.ma
ACME_EMAIL=ops@myshop.ma
EOF
chmod 600 .env

# 2. Build and start core services (db, backend, website).
docker compose up -d --build
```

### Migrations

The backend image runs migrations on every container start, before the server boots:

```
npx prisma migrate deploy --schema=packages/backend/prisma/schema.prisma
  && node packages/backend/dist/server.js
```

So `docker compose up -d` already applies all pending migrations. To run them
manually (e.g. on a managed Postgres, backend run outside Docker):

```bash
cd stock-platform/packages/backend
DATABASE_URL=postgresql://... npx prisma migrate deploy
```

### ⚠️ Baselining a database that was created with `db push`

If this database was first created with `prisma db push` (no migration history),
`migrate deploy` will try to re-create existing tables and fail. Baseline it once
by marking the initial migration as already applied **before** the first deploy:

```bash
cd stock-platform/packages/backend
# The first (baseline) migration directory under prisma/migrations/ is `0_init`:
npx prisma migrate resolve --applied 0_init
npx prisma migrate resolve --applied 1_partial_unique_indexes  # only if those indexes already exist
# Then apply the rest normally:
npx prisma migrate deploy
```

---

## 3. Enabling TLS (HTTPS sync channel)

The backend is **not** published to the public interface — it binds to `127.0.0.1`
on the host (for local admin) and is otherwise reachable only over the internal
Compose network. Public traffic terminates at Caddy.

```bash
# Requires SYNC_DOMAIN (and ideally ACME_EMAIL) in .env, and DNS pointing at this host.
docker compose --profile tls up -d
```

Caddy obtains and renews Let's Encrypt certificates automatically and proxies
`https://$SYNC_DOMAIN` → `backend:3001` over the internal network. Ports 80 and 443
are the only ones exposed publicly.

### Desktop client configuration

Point each desktop app at the HTTPS endpoint:

```
SYNC_SERVER_URL=https://sync.myshop.ma
```

Plaintext `http://` should be used **only on loopback** (e.g. `http://127.0.0.1:3001`
for local admin on the server itself). Never sync over plaintext HTTP across a network.

> **Troubleshooting — desktops get "connection refused":** the backend is bound to
> `127.0.0.1`, so nothing is reachable off the server until you start the TLS profile
> (`docker compose --profile tls up -d`) and point desktops at `https://$SYNC_DOMAIN`.
> If you ran only `docker compose up -d` (core), remote machines cannot reach the
> backend by design. For a trusted-LAN shop with no domain, you may instead re-publish
> the backend on the LAN by adding a `docker-compose.lan.override.yml` that maps
> `0.0.0.0:3001:3001` for the `backend` service — but then sync runs over plaintext
> HTTP and the API key crosses the wire in clear, so only do this on a trusted LAN.

---

## 4. Backups (`scripts/pg-backup.sh`)

`scripts/pg-backup.sh` writes a timestamped, compressed `pg_dump -Fc` dump to
`BACKUP_DIR`, then prunes dumps older than `RETENTION_DAYS`. It reads the connection
from `DATABASE_URL` (preferred) or the standard `PG*` variables.

### Manual run

```bash
DATABASE_URL=postgresql://postgres:<pw>@127.0.0.1:5432/stock_platform \
BACKUP_DIR=/var/backups/stock \
RETENTION_DAYS=14 \
  ./stock-platform/scripts/pg-backup.sh
```

### Scheduling with cron (daily 02:30, 14-day retention)

```cron
30 2 * * *  DATABASE_URL=postgresql://postgres:<pw>@127.0.0.1:5432/stock_platform \
            BACKUP_DIR=/var/backups/stock RETENTION_DAYS=14 \
            /opt/stock/stock-platform/scripts/pg-backup.sh >> /var/log/stock-backup.log 2>&1
```

> The script makes its target dir, writes to a `.partial` file then atomically
> renames, so it is safe to run on a schedule and an interrupted run never leaves a
> corrupt-looking dump. `pg_dump`/`pg_restore` must be installed on the host
> (`postgresql-client`), or run the script inside the `db` container.

---

## 5. Restore test (do this BEFORE you need it)

A backup you have never restored is not a backup. Verify into a throwaway database:

```bash
# 1. Pick a dump produced by pg-backup.sh.
DUMP=/var/backups/stock/stock_platform-20260616-013000.dump

# 2. Create an empty scratch database.
createdb -h 127.0.0.1 -U postgres restore_test

# 3. Restore into it (custom format → pg_restore).
pg_restore --no-owner --no-privileges \
  -h 127.0.0.1 -U postgres -d restore_test "$DUMP"

# 4. Sanity-check a core table has rows / expected schema.
psql -h 127.0.0.1 -U postgres -d restore_test -c 'SELECT COUNT(*) FROM "suppliers";'

# 5. Drop the scratch DB.
dropdb -h 127.0.0.1 -U postgres restore_test
```

A successful `pg_restore` with a sensible `COUNT(*)` confirms the dump is usable.
Schedule a restore test at least monthly.

---

## 6. Health & monitoring

- `GET /api/health` returns `200 {status:"ok"}` only when the DB is reachable **and
  migrated** — it runs `SELECT COUNT(*) FROM "suppliers"`. An un-migrated or
  unreachable DB returns `503`. Compose/Docker healthchecks already use this endpoint.
- CI (`.github/workflows/ci.yml`, job `migrate-deploy-e2e`) runs the same
  `prisma migrate deploy` as production, then a real `SELECT` and a live `/api/health`
  probe — so a broken/missing migration fails the build rather than reaching prod.

---

## 7. Quick go-live checklist

- [ ] `.env` created with `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY` (32+ chars each), `chmod 600`.
- [ ] DNS for `SYNC_DOMAIN` points at the host (if using TLS).
- [ ] `docker compose up -d --build` (core) then `docker compose --profile tls up -d` (TLS).
- [ ] Existing `db push` database baselined with `prisma migrate resolve --applied <init_migration>`.
- [ ] `/api/health` returns `200`.
- [ ] Desktop `SYNC_SERVER_URL` set to `https://<SYNC_DOMAIN>`.
- [ ] `pg-backup.sh` scheduled in cron **and** a restore test completed successfully.
