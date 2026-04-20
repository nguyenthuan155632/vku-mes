# VKU MES — Design Spec

**Date:** 2026-04-20
**Status:** Approved
**Scope:** Single-factory MES for monitoring CNC / packaging machines via hardware pulse counters, with operator manual entry and supervisor oversight. v1.

## 1. Goals & non-goals

**Goals**
- Real-time dashboard of 4+ workcenters showing per-shift quantity, last 4 hours of output, runtime, and a composite performance percentage.
- Ingest hardware counter pulses via HTTP and accept manual operator corrections.
- Detect machine silence, open downtime events, raise and resolve alerts.
- Compute OEE (Availability × Performance × Quality) per shift.
- Operator / Supervisor / Viewer roles via three shared passwords.

**Non-goals (v1)**
- Multi-factory / multi-tenant.
- Per-user accounts or audit trail beyond role.
- Operator-to-machine binding enforcement (any operator can manual-enter for any machine).
- i18n framework — Vietnamese UI strings hardcoded behind a `strings.ts` constant module.
- Quality gate via dedicated QC tooling — defects are entered manually alongside production qty.

## 2. Architecture

Three Docker Compose services, single repo, single Node image with two entrypoints.

| Service | Image base | Role |
|---|---|---|
| `db` | `timescale/timescaledb:2.16.1-pg15` | PostgreSQL 15 + TimescaleDB. Persistent volume. |
| `web` | Node 20 + Next.js 14 standalone build | Serves dashboard UI and all `/api/*` routes. |
| `worker` | Same image as `web`, different entrypoint | `node-cron` ticking every 30s: downtime detection, alert engine, shift-rollover at 08:00 and 20:00 Asia/Ho_Chi_Minh. |

`web` exposes `:3000`; `worker` exposes nothing. Both reach `db` over the compose-internal network.

### Repo layout

```
/
├── docker-compose.yml
├── Dockerfile                      # multi-stage; one image, two entrypoints
├── drizzle.config.ts
├── drizzle/                        # migration SQL files (incl. raw hypertable SQL)
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (dashboard)/page.tsx    # operator dashboard
│   │   ├── supervisor/page.tsx
│   │   ├── admin/workcenters/page.tsx
│   │   ├── login/page.tsx
│   │   └── api/                    # all REST endpoints
│   ├── server/
│   │   ├── db/                     # drizzle schema, client
│   │   ├── engine/                 # OEE, shift math, downtime detector — pure functions
│   │   ├── auth/                   # session cookie helpers, role guards
│   │   └── repos/                  # query layer used by API routes + worker
│   ├── worker/
│   │   └── index.ts                # node-cron entry: tick + shift-rollover
│   ├── components/                 # shadcn/ui-based UI components
│   ├── lib/
│   │   └── strings.ts              # all UI Vietnamese strings
│   └── middleware.ts               # auth redirect
├── scripts/
│   ├── seed.ts                     # 4 workcenters
│   ├── migrate.ts                  # drizzle migrate runner
│   ├── simulate-pulses.js          # demo pulse generator
│   └── smoke.sh                    # smoke test
└── tests/                          # vitest unit tests on src/server/engine
```

### Key decisions

- **Backend:** Next.js API routes, no separate Express layer. Background work runs in a dedicated `worker` container that imports the same `src/server/engine/` and `src/server/repos/` modules. (No serverless quirks because compose deployment is long-running.)
- **ORM:** Drizzle. Schema-as-TS, raw SQL migrations for hypertable creation. No fight with TimescaleDB-specific DDL.
- **Auth:** three shared passwords (env vars), signed cookie session storing only `role`. No `users` table.
- **No machine binding:** every logged-in operator can manual-enter for any workcenter. Audit captures `role` only.

## 3. Database schema

All timestamps `timestamptz` (UTC). Vietnam display happens in the UI layer.

```sql
CREATE TYPE pulse_source AS ENUM ('sensor', 'manual');
CREATE TYPE alert_type   AS ENUM ('silent_machine', 'low_output');
CREATE TYPE user_role    AS ENUM ('operator', 'supervisor', 'viewer');

CREATE TABLE workcenters (
  id                          serial PRIMARY KEY,
  code                        text UNIQUE NOT NULL,           -- e.g. WC01
  name                        text NOT NULL,                  -- "Máy Đóng Gói 01"
  target_qty_per_hour         int  NOT NULL,                  -- 0 allowed for utility machines
  alert_threshold_minutes     int  NOT NULL DEFAULT 10,       -- silence threshold
  low_output_threshold_pct    int  NOT NULL DEFAULT 60,       -- % of target_qty_per_hour
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE production_metrics (
  time            timestamptz NOT NULL,
  workcenter_id   int  NOT NULL REFERENCES workcenters(id),
  qty             int  NOT NULL CHECK (qty >= 0),
  defect_qty      int  NOT NULL DEFAULT 0 CHECK (defect_qty >= 0),
  source          pulse_source NOT NULL,
  note            text,                                       -- manual-entry reason
  PRIMARY KEY (time, workcenter_id)
);
SELECT create_hypertable('production_metrics', 'time', chunk_time_interval => INTERVAL '1 day');
CREATE INDEX ON production_metrics (workcenter_id, time DESC);

CREATE TABLE downtime_events (
  id                serial PRIMARY KEY,
  workcenter_id     int NOT NULL REFERENCES workcenters(id),
  start_time        timestamptz NOT NULL,
  end_time          timestamptz,
  duration_minutes  int GENERATED ALWAYS AS
                       (CASE WHEN end_time IS NULL THEN NULL
                             ELSE EXTRACT(EPOCH FROM (end_time - start_time))::int / 60 END) STORED,
  reason            text
);
CREATE INDEX ON downtime_events (workcenter_id, start_time DESC);
CREATE UNIQUE INDEX one_open_per_wc ON downtime_events (workcenter_id) WHERE end_time IS NULL;

CREATE TABLE shifts (
  id              serial PRIMARY KEY,
  workcenter_id   int NOT NULL REFERENCES workcenters(id),
  shift_date      date NOT NULL,                              -- Vietnam local date
  shift_number    smallint NOT NULL CHECK (shift_number IN (1, 2)),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  total_qty       int NOT NULL DEFAULT 0,
  defect_qty      int NOT NULL DEFAULT 0,
  runtime_minutes int NOT NULL DEFAULT 0,
  oee_score       numeric(5,4),                               -- null until closed
  closed_at       timestamptz,
  UNIQUE (workcenter_id, shift_date, shift_number)
);

CREATE TABLE alerts (
  id              serial PRIMARY KEY,
  workcenter_id   int NOT NULL REFERENCES workcenters(id),
  type            alert_type NOT NULL,
  message         text NOT NULL,
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     user_role
);
CREATE INDEX ON alerts (resolved_at) WHERE resolved_at IS NULL;
```

Notes:

- `production_metrics.PRIMARY KEY (time, workcenter_id)` matches Timescale best practice.
- `one_open_per_wc` partial unique index makes the "at most one open downtime per machine" invariant impossible to violate.
- `shifts.oee_score` stays `NULL` until the shift-rollover job closes the row; live OEE for the current shift is computed on-read in `/api/dashboard`.
- `target_qty_per_hour = 0` is allowed (compressors and other utility equipment); engine maps that to `performance = 0` and the UI shows `—`.

## 4. Engine logic (`src/server/engine/`)

Pure TypeScript modules. No I/O. All state passed in explicitly so each function is unit-testable in isolation.

### 4.1 `shift.ts`

```ts
shiftWindowFor(now: Date): { date: string, number: 1|2, startsAt: Date, endsAt: Date }
```

Vietnam local: shift 1 = 08:00→20:00, shift 2 = 20:00→08:00 (next day). Worker detects boundary cross by comparing `shiftWindowFor(prevTickTime).startsAt` against `shiftWindowFor(now).startsAt`.

### 4.2 `oee.ts`

```ts
computeOEE(input: {
  shiftLengthMin: number,        // 480
  runtimeMin: number,
  totalQty: number,
  defectQty: number,
  targetQtyPerHour: number
}): { availability: number, performance: number, quality: number, oee: number }
```

- `availability = clamp(runtimeMin / shiftLengthMin, 0, 1)`.
- `performance = totalQty / (targetQtyPerHour * runtimeMin / 60)`. If `runtimeMin === 0` or `targetQtyPerHour === 0` → `0`. Then clamped to `[0, 1]`.
- `quality = (totalQty - defectQty) / totalQty`. If `totalQty === 0` → `1`. Then clamped.
- `oee = availability * performance * quality`.

### 4.3 `hourly.ts`

```ts
bucketHourly(rows: { time: Date, qty: number }[], now: Date, hours: number)
  : { hourLabel: string, hourStart: Date, qty: number }[]
```

Pure aggregation over rows already fetched. Used so the H-1..H-4 view runs against the dashboard payload without a Postgres round-trip per hour. Production query in `repos/` uses Timescale `time_bucket('1 hour', time)` for efficiency.

### 4.4 `downtime.ts`

```ts
detectDowntime(input: {
  workcenterId: number,
  lastPulseAt: Date | null,
  openDowntime: { id: number, startTime: Date } | null,
  alertThresholdMin: number,
  now: Date
}): {
  action: 'none'
        | { kind: 'open',  startTime: Date }
        | { kind: 'close', id: number, endTime: Date },
  alert?: { type: 'silent_machine', message: string }
}
```

- Silent ≥ threshold AND no open downtime → `open`, emit alert.
- Pulse arrived within threshold AND open downtime exists → `close`.
- Otherwise → `none`.

### 4.5 `alerts.ts`

```ts
checkLowOutput(input: {
  workcenterId: number,
  lastHourQty: number,
  targetQtyPerHour: number,
  thresholdPct: number,
  hasOpenAlert: boolean
}): { alert?: { type: 'low_output', message: string } }
```

Returns an alert if `lastHourQty < target * thresholdPct/100` and no open `low_output` alert exists for that workcenter.

### 4.6 Worker tick (impure orchestrator)

Every 30s:

1. For each workcenter, fetch `lastPulseAt`, open downtime, open alerts (one query per workcenter or one batched query).
2. Apply `detectDowntime` → INSERT/UPDATE downtime row, INSERT alert if dedupe permits.
3. Fetch last-hour qty, apply `checkLowOutput` → INSERT alert if any.
4. Shift-rollover: if `shiftWindowFor(now).startsAt !== shiftWindowFor(prevTick).startsAt`, close all open shifts ≤ now (compute final `total_qty`, `defect_qty`, `runtime_minutes`, `oee_score`) and INSERT a new `shifts` row per workcenter.

## 5. API endpoints

All routes in `src/app/api/`. Auth middleware reads the signed cookie and attaches `{ role }`. Role guards in `src/server/auth/guards.ts`.

| Method & path | Auth | Body / query | Notes |
|---|---|---|---|
| `POST /api/auth/login` | public | `{ password }` | Compares against `OPERATOR_PASSWORD` / `SUPERVISOR_PASSWORD` / `VIEWER_PASSWORD`. Sets HMAC-signed `mes_session` cookie (HttpOnly, SameSite=Lax, 12h). |
| `POST /api/auth/logout` | any | — | Clears cookie. |
| `GET /api/auth/me` | any | — | Returns `{ role }`. |
| `POST /api/pulse` | bearer token | `{ workcenter_id, qty, source: 'sensor' }` | Gated by `Authorization: Bearer $PULSE_INGEST_TOKEN`. Inserts with `time = now()`. |
| `POST /api/manual-entry` | operator + supervisor | `{ workcenter_id, qty, defect_qty?, reason? }` | `qty` may be negative for corrections. `note` = reason. |
| `GET /api/dashboard` | any | — | Single payload, polled every 10s. Three queries total regardless of workcenter count. |
| `GET /api/workcenter/:id/hourly?hours=8` | any | — | Per-machine hourly buckets (default 8h, max 24h). |
| `GET /api/hourly?hours=8` | any | — | All workcenters' hourly buckets in one call (used by supervisor chart). |
| `GET /api/workcenters` | any | — | List for simulator + admin page. |
| `POST /api/workcenters` | supervisor | `{ code, name, target_qty_per_hour, alert_threshold_minutes?, low_output_threshold_pct? }` | |
| `PATCH /api/workcenters/:id` | supervisor | partial of above | `code` immutable after create. |
| `GET /api/downtime?from=&to=&workcenter_id=` | any | — | Default last 24h, all machines. |
| `POST /api/downtime/:id/reason` | supervisor | `{ reason }` | |
| `GET /api/alerts?status=open\|all` | any | — | Default `open`. |
| `POST /api/alerts/:id/acknowledge` | supervisor | — | Sets `resolved_at = now()`, `resolved_by = 'supervisor'`. |

### `GET /api/dashboard` payload shape

```jsonc
{
  "now": "2026-04-20T07:30:00Z",
  "shiftWindow": { "date": "2026-04-20", "number": 1,
                   "startsAt": "2026-04-20T01:00:00Z", "endsAt": "2026-04-20T13:00:00Z" },
  "totals": { "running": 3, "stopped": 1, "shiftQty": 12450 },
  "workcenters": [
    {
      "id": 1, "code": "WC01", "name": "Máy Đóng Gói 01",
      "status": "running",
      "shiftQty": 4210, "shiftDefectQty": 18,
      "hourly": [
        { "label": "H-4", "qty": 520 },
        { "label": "H-3", "qty": 540 },
        { "label": "H-2", "qty": 510 },
        { "label": "H-1", "qty": 495 }
      ],
      "runtimeMinutes": 412,
      "performancePct": 0.87
    }
  ]
}
```

Errors: `{ error: { code, message } }` on 4xx/5xx. User-facing messages in Vietnamese.

## 6. Frontend

Stack: Next.js 14 App Router, Tailwind, shadcn/ui (`button`, `card`, `dialog`, `badge`, `progress`, `table`, `dropdown-menu`, `input`, `label`, `sonner`), Recharts, SWR. Dark theme on `<html class="dark">`, navy background `#0a0e1f`.

### Routes

| Path | Roles | Purpose |
|---|---|---|
| `/login` | public | Single password field. Password alone determines role. |
| `/` | any logged in | Operator dashboard. |
| `/supervisor` | supervisor + viewer | Summary, downtime log, hourly chart, alert feed. |
| `/admin/workcenters` | supervisor only | List + create/edit form for workcenters. |

`src/middleware.ts` redirects unauthenticated → `/login` and `viewer` → `/supervisor` if they hit `/admin/workcenters`.

### Operator dashboard `/`

Header (sticky, dark navy):

- Left: app title.
- Center: live clock (`setInterval(1000)`, `HH:mm:ss • dd/MM/yyyy`, Asia/Ho_Chi_Minh).
- Right: three KPI chips — Đang chạy (green), Đang dừng (red), Tổng sản lượng CA.
- Far right: role badge + logout + (supervisor) links to `/supervisor` and `/admin/workcenters`.

Machine table — one shadcn `<Card>` wrapping a `<Table>`:

| STT | Tên máy | Trạng thái | Sản lượng CA | H-4 | H-3 | H-2 | H-1 | Thời gian hoạt động | Hiệu suất |

Row interactions:

- Whole row clickable → manual-entry modal (disabled for `viewer`).
- Status badge: green for running, red for stopped (= has open downtime).
- H-1..H-4: small chips, slate background.
- Progress bar: shadcn `<Progress>`, amber when `runtime/480 < 0.7`, green ≥ 0.85.
- Hiệu suất %: amber/orange text per the reference UI.

SWR:

```ts
useSWR('/api/dashboard', fetcher, {
  refreshInterval: 10_000,
  revalidateOnFocus: false,
  keepPreviousData: true,
});
```

Manual-entry modal (shadcn `<Dialog>`):

- Title: `Nhập sản lượng — {workcenter.name}`.
- Fields: `qty` (number, helper text "âm để hiệu chỉnh giảm"), `defect_qty` (number, default 0), `reason` (textarea, optional).
- Submit → `POST /api/manual-entry` → toast → `mutate('/api/dashboard')`.
- Hidden if role === `viewer`.

### Supervisor view `/supervisor`

Summary cards (4-up):

1. Tổng sản lượng CA (sum across workcenters).
2. OEE trung bình (runtime-weighted average).
3. Đang chạy / Đang dừng counts.
4. Cảnh báo chưa xử lý (open alert count, anchor link to alert feed).

Hourly output chart — Recharts `<BarChart>`, last 8 hours, fed by `GET /api/hourly?hours=8`. Toggle stacked vs grouped.

Downtime log — shadcn `<Table>`: machine, start, end, duration, reason. Reason cell editable inline (popover) for supervisors; viewers see plain text. Filters: date range + workcenter dropdown.

Alert feed — list of open alerts with `{type icon} {message} {triggered_at relative}` and "Xác nhận" button (supervisor only).

### Admin `/admin/workcenters`

Table of workcenters with edit/create. Form fields: code (immutable after create), name, target_qty_per_hour, alert_threshold_minutes, low_output_threshold_pct.

### Component organization

```
src/components/
├── ui/                          # shadcn primitives
├── dashboard/
│   ├── header-bar.tsx
│   ├── kpi-chip.tsx
│   ├── machine-table.tsx
│   ├── machine-row.tsx
│   ├── hour-badges.tsx
│   ├── runtime-bar.tsx
│   └── manual-entry-dialog.tsx
├── supervisor/
│   ├── summary-cards.tsx
│   ├── hourly-chart.tsx
│   ├── downtime-table.tsx
│   └── alert-feed.tsx
└── admin/
    └── workcenter-form.tsx
```

### Localization

- All UI strings hardcoded in `src/lib/strings.ts` (no i18n framework).
- Numbers via `Intl.NumberFormat('vi-VN')`.
- Times via `date-fns-tz` with `Asia/Ho_Chi_Minh`.

## 7. Role permission matrix

| Action | Supervisor | Operator | Viewer |
|---|---|---|---|
| View dashboard `/` | ✓ | ✓ | ✓ |
| View `/supervisor` | ✓ | ✗ | ✓ (read-only inline edits disabled) |
| View `/admin/workcenters` | ✓ | ✗ | ✗ |
| Manual entry (qty + defects) | ✓ (any machine) | ✓ (any machine) | ✗ |
| Create / edit workcenter | ✓ | ✗ | ✗ |
| Set downtime reason | ✓ | ✗ | ✗ |
| Acknowledge alert | ✓ | ✗ | ✗ |

## 8. Ops

### `docker-compose.yml`

```yaml
services:
  db:
    image: timescale/timescaledb:2.16.1-pg15
    environment:
      POSTGRES_USER: mes
      POSTGRES_PASSWORD: mes
      POSTGRES_DB: mes
    volumes: [db_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mes"]
      interval: 5s
      retries: 10
  web:
    build: .
    command: ["sh", "-c", "node scripts/migrate.js && node server.js"]
    environment:
      DATABASE_URL: postgres://mes:mes@db:5432/mes
      SESSION_SECRET: ${SESSION_SECRET}
      OPERATOR_PASSWORD: ${OPERATOR_PASSWORD}
      SUPERVISOR_PASSWORD: ${SUPERVISOR_PASSWORD}
      VIEWER_PASSWORD: ${VIEWER_PASSWORD}
      PULSE_INGEST_TOKEN: ${PULSE_INGEST_TOKEN}
      TZ: Asia/Ho_Chi_Minh
    depends_on: { db: { condition: service_healthy } }
    ports: ["3000:3000"]
  worker:
    build: .
    command: ["node", "dist/worker/index.js"]
    environment:
      DATABASE_URL: postgres://mes:mes@db:5432/mes
      TZ: Asia/Ho_Chi_Minh
    depends_on: { db: { condition: service_healthy } }
volumes:
  db_data:
```

`.env.example` ships with sane dev defaults.

### Migrations

- Drizzle migrations in `drizzle/*.sql`. `scripts/migrate.ts` runs them at `web` startup.
- Hypertable creation lives in the first migration as raw SQL.

### Seed (`scripts/seed.ts`, idempotent via `ON CONFLICT (code) DO NOTHING`)

```ts
const SEED = [
  { code: 'WC01', name: 'Máy Đóng Gói 01',    target_qty_per_hour: 600 },
  { code: 'WC02', name: 'Máy Nén Khí 02',     target_qty_per_hour: 0   }, // utility — no qty target
  { code: 'WC03', name: 'Máy Kiểm Tra QC 03', target_qty_per_hour: 450 },
  { code: 'WC04', name: 'Máy Phay CNC 04',    target_qty_per_hour: 200 },
];
```

Run via `docker compose exec web npm run seed`.

### Pulse simulator (`scripts/simulate-pulses.js`)

```
node scripts/simulate-pulses.js --base http://localhost:3000 --token $PULSE_INGEST_TOKEN
```

- Reads workcenters from `GET /api/workcenters`.
- Loops every 2–5s (random), picks a random workcenter, posts `{ workcenter_id, qty: random(1..3), source: 'sensor' }` to `/api/pulse`.
- 5% of ticks: skip a workcenter for 12 minutes to trigger `silent_machine` alert + downtime event.
- Plain Node 20+, no deps beyond built-in `fetch`.

### Smoke test (`scripts/smoke.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
docker compose up -d --build
docker compose exec -T web npm run seed
node scripts/simulate-pulses.js --base http://localhost:3000 --token "$PULSE_INGEST_TOKEN" --duration 30 &
sleep 35
COOKIE=$(curl -s -c - -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$SUPERVISOR_PASSWORD\"}" | grep mes_session | awk '{print $7}')
RESP=$(curl -s -H "Cookie: mes_session=$COOKIE" http://localhost:3000/api/dashboard)
echo "$RESP" | jq -e '.workcenters | length == 4' > /dev/null
echo "$RESP" | jq -e '.totals.shiftQty > 0'      > /dev/null
echo "$RESP" | jq -e '.workcenters[0].hourly | length == 4' > /dev/null
echo "smoke OK"
docker compose down
```

## 9. Testing

Per agreed scope: targeted Vitest unit tests on `src/server/engine/*` plus the smoke script. ~10–15 tests:

- `engine/shift.ts`: shift 1/shift 2 boundaries, midnight crossing.
- `engine/oee.ts`: zero runtime, zero qty, full quality, mixed defects, `target_qty_per_hour=0` utility machine.
- `engine/downtime.ts`: open new event, close existing, dedupe, never-produced workcenter.
- `engine/alerts.ts`: low-output below threshold, dedupe vs. existing open alert.
- `engine/hourly.ts`: bucket assignment with sparse data and across hour boundary.

Worker and API handlers covered end-to-end via the smoke script.

## 10. README

`README.md` is in Vietnamese and includes: yêu cầu hệ thống, hướng dẫn `cp .env.example .env`, `docker compose up -d --build`, `docker compose exec web npm run seed`, `node scripts/simulate-pulses.js`, mô tả ba tài khoản đăng nhập (operator / supervisor / viewer) và URL `/`, `/supervisor`, `/admin/workcenters`. Plus a "khắc phục sự cố" section for the 3 most common failures (DB không lên, port 3000 đã dùng, đồng hồ container sai múi giờ).

## 11. Open items deferred to future versions

- Per-user accounts and an audit trail beyond role.
- Operator-to-machine binding (any operator can manual-enter for any machine in v1).
- Multi-factory / multi-tenant.
- Dedicated QC tooling (defect_qty is operator-entered in v1).
- i18n framework — strings live in `src/lib/strings.ts` for an easy future wrap pass.
- Historical OEE trends and shift comparison reports.
