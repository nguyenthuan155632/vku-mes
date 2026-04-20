# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Next.js dev server
pnpm test         # Vitest unit tests (node environment, no DB)
pnpm test:watch   # Vitest in watch mode
pnpm typecheck    # TypeScript type check (no emit)
pnpm lint         # ESLint via next lint

pnpm migrate      # Run DB migrations (requires DATABASE_URL)
pnpm seed         # Seed 4 sample workcenters

pnpm worker:dev   # Run background worker locally (tsx)
pnpm worker:build # Compile worker to dist/ for Docker
```

Run a single test file: `pnpm vitest run tests/engine/shift.test.ts`

## Architecture

Three containers (see `docker-compose.yml`):
- **web** — Next.js 14 app router; serves all pages and `/api/*` routes
- **worker** — standalone Node process (`src/worker/index.ts`); ticks every 30 s via `node-cron`; detects downtime, checks low-output alerts, closes shifts at boundaries
- **db** — PostgreSQL 15 + TimescaleDB 2.x; `production_metrics` is a hypertable

### Source layout

```
src/
  app/           Next.js pages and API route handlers
  components/    React components (dashboard/, supervisor/, admin/, ui/)
  hooks/         Client-side SWR hooks
  lib/           Shared client-safe utilities and types
  middleware.ts  Auth + route guards (Next.js edge middleware)
  server/
    auth/        session.ts (HMAC-signed cookie), guards.ts
    db/          schema.ts (Drizzle schema), client.ts, client.worker.ts
    engine/      Pure business logic: shift.ts, oee.ts, downtime.ts, alerts.ts, hourly.ts
    repos/       DB query wrappers (one file per table group)
    services/    dashboard.ts (orchestrates repos for the dashboard API)
  worker/        index.ts — background ticker
```

### Key design decisions

**Auth** — custom HMAC-signed cookies (no NextAuth). `SESSION_SECRET` env var required. Three roles: `supervisor > operator > viewer`. Middleware in `src/middleware.ts` enforces page-level access; `server/auth/guards.ts` enforces API-level access. The `/api/pulse` endpoint uses a separate `PULSE_INGEST_TOKEN` for hardware sensors.

**Timezone** — all shift logic uses Vietnam time (UTC+7). The engine files compute shifts without relying on system timezone — always pass explicit `Date` objects. Shift 1: 08:00–20:00 VN; Shift 2: 20:00–08:00 VN.

**DB client split** — `client.ts` is Next.js server-side (uses `@vercel/postgres` compatible pool); `client.worker.ts` is for the worker process. Both use Drizzle ORM over `pg`.

**Engine layer** (`server/engine/`) — pure functions with no DB imports; easy to unit-test. Repos (`server/repos/`) do all DB access and are thin query wrappers. This separation is intentional — keep it.

**Tests** — Vitest, node environment, no database. Tests live in `tests/` with an alias `@` → `src/`. Engine tests are pure function tests. Smoke tests (`tests/smoke.test.ts`) hit a live DB and are skipped in CI unless `DATABASE_URL` is set.

### Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | HMAC signing key for session cookies |
| `PULSE_INGEST_TOKEN` | Bearer token for `/api/pulse` (hardware sensors) |
| `SUPERVISOR_PASSWORD` / `OPERATOR_PASSWORD` / `VIEWER_PASSWORD` | Login passwords per role |
| `TZ` | Must be `Asia/Ho_Chi_Minh` in both `web` and `worker` containers |
