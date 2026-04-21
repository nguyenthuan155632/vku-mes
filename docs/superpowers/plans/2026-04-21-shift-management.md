# Shift Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded 2×12h shifts with DB-driven configurable shift templates, add ghost production alerting for pulses outside shift windows, and build a supervisor UI to manage shift schedules.

**Architecture:** A new `shift_templates` table drives all shift logic. `shiftWindowFor` is refactored to accept templates as a parameter, returning `null` when no shift covers the current time. The worker caches templates (5-min TTL) and fires `unscheduled_production` alerts when pulses arrive in a gap. A new `/admin/shifts` page lets supervisors add/edit/disable templates with live coverage visualisation.

**Tech Stack:** PostgreSQL + Drizzle ORM, Next.js 14 App Router, Vitest, SWR, zod, shadcn/ui (Button, Input, Label, Card, Table, Dialog, Badge), sonner (toast)

---

### Task 1: DB migration + schema

**Files:**
- Create: `drizzle/0002_shift_templates.sql`
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Write `drizzle/0002_shift_templates.sql`**

```sql
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'unscheduled_production';

CREATE TABLE shift_templates (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  shift_number SMALLINT NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults matching previous hardcoded behaviour
INSERT INTO shift_templates (name, shift_number, start_time, end_time)
VALUES ('Ca 1', 1, '08:00', '20:00'),
       ('Ca 2', 2, '20:00', '08:00');
```

- [ ] **Step 2: Update `src/server/db/schema.ts`**

Replace the `alertType` line:
```ts
export const alertType = pgEnum('alert_type', ['silent_machine', 'low_output', 'unscheduled_production']);
```

Add after the `alerts` table definition:
```ts
export const shiftTemplates = pgTable('shift_templates', {
  id:          serial('id').primaryKey(),
  name:        text('name').notNull(),
  shiftNumber: smallint('shift_number').notNull(),
  startTime:   text('start_time').notNull(),
  endTime:     text('end_time').notNull(),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Run migration (requires DATABASE_URL)**

```bash
pnpm migrate
```

Expected:
```
[migrate] applying 0002_shift_templates.sql
[migrate] done
```

- [ ] **Step 4: Commit**

```bash
git add drizzle/0002_shift_templates.sql src/server/db/schema.ts
git commit -m "feat: shift_templates table and unscheduled_production alert type"
```

---

### Task 2: Engine refactor — `shift.ts`

**Files:**
- Modify: `src/server/engine/shift.ts`

The current file is 59 lines hardcoded to 08:00/20:00. Replace it entirely.

- [ ] **Step 1: Rewrite `src/server/engine/shift.ts`**

```ts
const VN_OFFSET_HOURS = 7;

export type ShiftTemplate = {
  id: number;
  name: string;
  shiftNumber: number;
  startTime: string; // "HH:MM" Vietnam local
  endTime: string;   // "HH:MM" Vietnam local
};

export interface ShiftWindow {
  date: string;          // YYYY-MM-DD anchored to shift start date (Vietnam)
  number: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
  shiftLengthMin: number;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function vnMidnightUtc(y: number, mo: number, d: number): Date {
  return new Date(Date.UTC(y, mo, d) - VN_OFFSET_HOURS * 3600_000);
}

function formatDate(y: number, mo: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(mo + 1)}-${pad(d)}`;
}

/**
 * Returns the ShiftWindow whose window covers `now`, or null if no template covers it.
 * Cross-midnight templates are anchored to the date on which they start.
 */
export function shiftWindowFor(now: Date, templates: ShiftTemplate[]): ShiftWindow | null {
  const vnNow = new Date(now.getTime() + VN_OFFSET_HOURS * 3600_000);
  const y = vnNow.getUTCFullYear();
  const mo = vnNow.getUTCMonth();
  const d = vnNow.getUTCDate();

  for (const tpl of templates) {
    const startMin = timeToMin(tpl.startTime);
    const endMin = timeToMin(tpl.endTime);
    const crossMidnight = endMin <= startMin;
    const durationMin = crossMidnight ? (1440 - startMin + endMin) : (endMin - startMin);

    // Try today's VN-date anchor
    const midnight = vnMidnightUtc(y, mo, d);
    const startsAt = new Date(midnight.getTime() + startMin * 60_000);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    if (now >= startsAt && now < endsAt) {
      return { date: formatDate(y, mo, d), number: tpl.shiftNumber, name: tpl.name, startsAt, endsAt, shiftLengthMin: durationMin };
    }

    // Cross-midnight: also try yesterday's anchor (e.g. 02:00 VN is inside 20:00→08:00 started yesterday)
    if (crossMidnight) {
      const prev = new Date(Date.UTC(y, mo, d) - 24 * 3600_000);
      const py = prev.getUTCFullYear(), pmo = prev.getUTCMonth(), pd = prev.getUTCDate();
      const prevMidnight = vnMidnightUtc(py, pmo, pd);
      const prevStartsAt = new Date(prevMidnight.getTime() + startMin * 60_000);
      const prevEndsAt = new Date(prevStartsAt.getTime() + durationMin * 60_000);
      if (now >= prevStartsAt && now < prevEndsAt) {
        return { date: formatDate(py, pmo, pd), number: tpl.shiftNumber, name: tpl.name, startsAt: prevStartsAt, endsAt: prevEndsAt, shiftLengthMin: durationMin };
      }
    }
  }

  return null;
}
```

Note: `SHIFT_LENGTH_MIN` constant and `ShiftNumber = 1 | 2` type are removed. Callers use `window.shiftLengthMin`.

- [ ] **Step 2: Typecheck — expect errors only in worker (fixed in Task 5)**

```bash
pnpm typecheck 2>&1 | grep -v node_modules | head -30
```

Expected: errors only in `src/worker/index.ts` referencing removed `SHIFT_LENGTH_MIN`.

- [ ] **Step 3: Commit**

```bash
git add src/server/engine/shift.ts
git commit -m "refactor: shiftWindowFor accepts templates[], returns null for gaps"
```

---

### Task 3: Engine tests

**Files:**
- Modify: `tests/engine/shift.test.ts`

- [ ] **Step 1: Rewrite `tests/engine/shift.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { shiftWindowFor, type ShiftTemplate } from '@/server/engine/shift';

const TWO_SHIFTS: ShiftTemplate[] = [
  { id: 1, name: 'Ca 1', shiftNumber: 1, startTime: '08:00', endTime: '20:00' },
  { id: 2, name: 'Ca 2', shiftNumber: 2, startTime: '20:00', endTime: '08:00' },
];

const ONE_SHIFT: ShiftTemplate[] = [
  { id: 1, name: 'Ca ngày', shiftNumber: 1, startTime: '08:00', endTime: '16:00' },
];

describe('shiftWindowFor — two 12h shifts (matches previous hardcoded behaviour)', () => {
  test('09:00 VN → shift 1', () => {
    // 2026-04-20 09:00 VN = 02:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T02:00:00Z'), TWO_SHIFTS);
    expect(w).not.toBeNull();
    expect(w!.number).toBe(1);
    expect(w!.date).toBe('2026-04-20');
    expect(w!.startsAt.toISOString()).toBe('2026-04-20T01:00:00.000Z');
    expect(w!.endsAt.toISOString()).toBe('2026-04-20T13:00:00.000Z');
    expect(w!.shiftLengthMin).toBe(720);
  });

  test('20:00 VN → shift 2', () => {
    // 2026-04-20 20:00 VN = 13:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T13:00:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
    expect(w!.startsAt.toISOString()).toBe('2026-04-20T13:00:00.000Z');
    expect(w!.endsAt.toISOString()).toBe('2026-04-21T01:00:00.000Z');
    expect(w!.shiftLengthMin).toBe(720);
  });

  test('23:30 VN → shift 2 before midnight', () => {
    const w = shiftWindowFor(new Date('2026-04-20T16:30:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
  });

  test('03:00 VN next day → shift 2 anchored to prior date', () => {
    // 2026-04-21 03:00 VN = 2026-04-20 20:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T20:00:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
  });

  test('07:59 VN → still shift 2 of prior date', () => {
    const w = shiftWindowFor(new Date('2026-04-21T00:59:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(2);
    expect(w!.date).toBe('2026-04-20');
  });

  test('08:00 VN exactly → shift 1 of new date', () => {
    const w = shiftWindowFor(new Date('2026-04-21T01:00:00Z'), TWO_SHIFTS);
    expect(w!.number).toBe(1);
    expect(w!.date).toBe('2026-04-21');
  });
});

describe('shiftWindowFor — single 8h shift with gaps', () => {
  test('10:00 VN (inside) → returns window', () => {
    // 10:00 VN = 03:00 UTC
    const w = shiftWindowFor(new Date('2026-04-20T03:00:00Z'), ONE_SHIFT);
    expect(w).not.toBeNull();
    expect(w!.number).toBe(1);
    expect(w!.shiftLengthMin).toBe(480);
  });

  test('07:00 VN (before shift) → null', () => {
    const w = shiftWindowFor(new Date('2026-04-20T00:00:00Z'), ONE_SHIFT);
    expect(w).toBeNull();
  });

  test('17:00 VN (after shift) → null', () => {
    const w = shiftWindowFor(new Date('2026-04-20T10:00:00Z'), ONE_SHIFT);
    expect(w).toBeNull();
  });
});

describe('shiftWindowFor — edge cases', () => {
  test('empty templates → always null', () => {
    expect(shiftWindowFor(new Date('2026-04-20T02:00:00Z'), [])).toBeNull();
  });

  test('exactly at shift end → null (exclusive)', () => {
    // 16:00 VN = 09:00 UTC — endsAt of ONE_SHIFT
    expect(shiftWindowFor(new Date('2026-04-20T09:00:00Z'), ONE_SHIFT)).toBeNull();
  });

  test('exactly at shift start → in window (inclusive)', () => {
    // 08:00 VN = 01:00 UTC
    expect(shiftWindowFor(new Date('2026-04-20T01:00:00Z'), ONE_SHIFT)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run tests/engine/shift.test.ts
```

Expected: all 12 tests pass.

- [ ] **Step 3: Run full suite**

```bash
pnpm test
```

Expected: all tests pass (oee, downtime, alerts, hourly unaffected).

- [ ] **Step 4: Commit**

```bash
git add tests/engine/shift.test.ts
git commit -m "test: update shift engine tests for template-based shiftWindowFor"
```

---

### Task 4: Repos

**Files:**
- Create: `src/server/repos/shiftTemplates.ts`
- Modify: `src/server/repos/shifts.ts`

- [ ] **Step 1: Create `src/server/repos/shiftTemplates.ts`**

```ts
import { and, eq, ne } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import type { Database } from '@/server/db/types';

function durationMin(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return e > s ? e - s : 1440 - s + e;
}

export function shiftTemplatesRepo(db: Database) {
  return {
    list: () =>
      db.select().from(schema.shiftTemplates).orderBy(schema.shiftTemplates.shiftNumber),

    listActive: () =>
      db.select().from(schema.shiftTemplates)
        .where(eq(schema.shiftTemplates.isActive, true))
        .orderBy(schema.shiftTemplates.shiftNumber),

    getById: async (id: number) => {
      const [row] = await db.select().from(schema.shiftTemplates)
        .where(eq(schema.shiftTemplates.id, id));
      return row ?? null;
    },

    totalActiveDurationMin: async (excludeId?: number): Promise<number> => {
      const rows = await db.select().from(schema.shiftTemplates)
        .where(excludeId !== undefined
          ? and(eq(schema.shiftTemplates.isActive, true), ne(schema.shiftTemplates.id, excludeId))
          : eq(schema.shiftTemplates.isActive, true));
      return rows.reduce((sum, r) => sum + durationMin(r.startTime, r.endTime), 0);
    },

    create: async (input: { name: string; shiftNumber: number; startTime: string; endTime: string }) => {
      const [row] = await db.insert(schema.shiftTemplates).values(input).returning();
      return row;
    },

    update: async (id: number, input: { name?: string; shiftNumber?: number; startTime?: string; endTime?: string }) => {
      const [row] = await db.update(schema.shiftTemplates).set(input)
        .where(eq(schema.shiftTemplates.id, id)).returning();
      return row ?? null;
    },

    toggleActive: async (id: number, isActive: boolean) => {
      await db.update(schema.shiftTemplates).set({ isActive })
        .where(eq(schema.shiftTemplates.id, id));
    },

    delete: async (id: number) => {
      await db.delete(schema.shiftTemplates).where(eq(schema.shiftTemplates.id, id));
    },
  };
}
```

- [ ] **Step 2: Widen `shift_number` type in `src/server/repos/shifts.ts`**

On line 7, change `shift_number: 1 | 2` → `shift_number: number`:

```ts
upsertCurrent: async (i: { workcenter_id: number; shift_date: string; shift_number: number; starts_at: Date; ends_at: Date }) => {
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck 2>&1 | grep -v node_modules | head -20
```

Expected: errors only in `src/worker/index.ts` (fixed next task).

- [ ] **Step 4: Commit**

```bash
git add src/server/repos/shiftTemplates.ts src/server/repos/shifts.ts
git commit -m "feat: shiftTemplatesRepo + widen shift_number to number"
```

---

### Task 5: Worker update

**Files:**
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Replace `src/worker/index.ts` entirely**

```ts
import cron from 'node-cron';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../server/db/schema';
import { workcentersRepo } from '../server/repos/workcenters';
import { productionRepo } from '../server/repos/production';
import { downtimeRepo } from '../server/repos/downtime';
import { shiftsRepo } from '../server/repos/shifts';
import { alertsRepo } from '../server/repos/alerts';
import { shiftTemplatesRepo } from '../server/repos/shiftTemplates';
import { detectDowntime } from '../server/engine/downtime';
import { checkLowOutput } from '../server/engine/alerts';
import { shiftWindowFor, type ShiftTemplate } from '../server/engine/shift';
import { computeOEE } from '../server/engine/oee';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

let templateCache: ShiftTemplate[] = [];
let templateCacheAt = new Date(0);
const CACHE_TTL_MS = 5 * 60_000;

async function getTemplates(): Promise<ShiftTemplate[]> {
  if (Date.now() - templateCacheAt.getTime() > CACHE_TTL_MS) {
    const rows = await shiftTemplatesRepo(db).listActive();
    templateCache = rows.map(r => ({
      id: r.id, name: r.name, shiftNumber: r.shiftNumber,
      startTime: r.startTime, endTime: r.endTime,
    }));
    templateCacheAt = new Date();
  }
  return templateCache;
}

let prevTickAt = new Date(0);

async function tick() {
  const now = new Date();
  const templates = await getTemplates();
  const wc = workcentersRepo(db);
  const prod = productionRepo(db);
  const dt = downtimeRepo(db);
  const alerts = alertsRepo(db);
  const workcenters = await wc.list();
  const currWin = shiftWindowFor(now, templates);

  for (const w of workcenters) {
    try {
      const [lastPulseAt, open] = await Promise.all([prod.lastPulseAt(w.id), dt.getOpen(w.id)]);
      const d = detectDowntime({
        workcenterId: w.id, lastPulseAt,
        openDowntime: open ? { id: open.id, startTime: open.startTime as Date } : null,
        alertThresholdMin: w.alertThresholdMinutes, now
      });
      if (typeof d.action !== 'string') {
        if (d.action.kind === 'open') await dt.open(w.id, d.action.startTime);
        else await dt.close(d.action.id, d.action.endTime);
      }
      if (d.alert) {
        const already = await alerts.hasOpen(w.id, 'silent_machine');
        if (!already) await alerts.insert({ workcenter_id: w.id, type: 'silent_machine', message: d.alert.message });
      }

      const lastHour = await prod.qtyInRange(w.id, new Date(now.getTime() - 3600_000), now);
      const hasOpenLow = await alerts.hasOpen(w.id, 'low_output');
      const l = checkLowOutput({
        workcenterId: w.id, lastHourQty: lastHour.qty,
        targetQtyPerHour: w.targetQtyPerHour, thresholdPct: w.lowOutputThresholdPct,
        hasOpenAlert: hasOpenLow
      });
      if (l.alert) await alerts.insert({ workcenter_id: w.id, type: 'low_output', message: l.alert.message });

      // Ghost production: pulses arriving outside all shift windows
      if (!currWin) {
        const tickStart = new Date(now.getTime() - 35_000);
        const recent = await prod.qtyInRange(w.id, tickStart, now);
        if (recent.qty > 0) {
          const already = await alerts.hasOpen(w.id, 'unscheduled_production');
          if (!already) {
            const fmt = (dt: Date) => dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            await alerts.insert({
              workcenter_id: w.id, type: 'unscheduled_production',
              message: `${recent.qty} sản phẩm ghi nhận ${fmt(tickStart)}–${fmt(now)} — ngoài ca làm việc`
            });
          }
        }
      }
    } catch (err) {
      console.error(`[worker] workcenter ${w.id} tick failed`, err);
    }
  }

  // Shift rollover detection
  const prevWin = shiftWindowFor(prevTickAt, templates);
  const boundaryCrossed = prevTickAt.getTime() > 0
    && prevWin !== null
    && (currWin === null || prevWin.startsAt.getTime() !== currWin.startsAt.getTime());

  if (boundaryCrossed && prevWin) {
    console.log('[worker] shift boundary crossed, closing previous shifts');
    const sh = shiftsRepo(db);
    for (const w of workcenters) {
      const existing = await sh.upsertCurrent({
        workcenter_id: w.id, shift_date: prevWin.date,
        shift_number: prevWin.number, starts_at: prevWin.startsAt, ends_at: prevWin.endsAt
      });
      const totals = await prod.qtyInRange(w.id, prevWin.startsAt, prevWin.endsAt);
      const dtMin = await dt.minutesWithin(w.id, prevWin.startsAt, prevWin.endsAt);
      const runtime = Math.max(0, prevWin.shiftLengthMin - dtMin);
      const oee = computeOEE({
        shiftLengthMin: prevWin.shiftLengthMin, runtimeMin: runtime,
        totalQty: totals.qty, defectQty: totals.defectQty, targetQtyPerHour: w.targetQtyPerHour
      });
      await sh.close(existing.id, { totalQty: totals.qty, defectQty: totals.defectQty, runtimeMinutes: runtime, oeeScore: oee.oee });
    }
  }

  if (currWin) {
    const shCurr = shiftsRepo(db);
    for (const w of workcenters) {
      await shCurr.upsertCurrent({
        workcenter_id: w.id, shift_date: currWin.date,
        shift_number: currWin.number, starts_at: currWin.startsAt, ends_at: currWin.endsAt
      });
    }
  }

  prevTickAt = now;
}

console.log('[worker] starting, tick every 5s');
tick().catch((e) => console.error('[worker] initial tick failed', e));
cron.schedule('*/5 * * * * *', () => { tick().catch((e) => console.error('[worker] tick failed', e)); });
```

- [ ] **Step 2: Typecheck — expect clean**

```bash
pnpm typecheck 2>&1 | grep -v node_modules
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/worker/index.ts
git commit -m "feat: worker uses DB-driven shift templates, ghost production alerts, null gap handling"
```

---

### Task 6: API routes

**Files:**
- Create: `src/app/api/admin/shift-templates/route.ts`
- Create: `src/app/api/admin/shift-templates/[id]/route.ts`

Shared helpers used in both files:

```ts
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function durationMin(start: string, end: string): number {
  const s = timeToMin(start), e = timeToMin(end);
  return e > s ? e - s : 1440 - s + e;
}
// Returns true if the two HH:MM time ranges overlap
function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const a = timeToMin(s1), b = timeToMin(e1), c = timeToMin(s2), d = timeToMin(e2);
  const inRange = (min: number, start: number, end: number) =>
    end > start ? min >= start && min < end : min >= start || min < end;
  return inRange(c, a, b) || inRange(a, c, d);
}
```

- [ ] **Step 1: Create `src/app/api/admin/shift-templates/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { shiftTemplatesRepo } from '@/server/repos/shiftTemplates';
import { requireRole } from '@/server/auth/guards';

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function durationMin(start: string, end: string): number {
  const s = timeToMin(start), e = timeToMin(end);
  return e > s ? e - s : 1440 - s + e;
}
function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const a = timeToMin(s1), b = timeToMin(e1), c = timeToMin(s2), d = timeToMin(e2);
  const inRange = (min: number, start: number, end: number) =>
    end > start ? min >= start && min < end : min >= start || min < end;
  return inRange(c, a, b) || inRange(a, c, d);
}

const CreateBody = z.object({
  name:         z.string().min(1).max(64),
  shift_number: z.number().int().min(1),
  start_time:   z.string().regex(/^\d{2}:\d{2}$/),
  end_time:     z.string().regex(/^\d{2}:\d{2}$/),
});

export async function GET() {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;
  return NextResponse.json(await shiftTemplatesRepo(db).list());
}

export async function POST(req: Request) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  }

  const { name, shift_number, start_time, end_time } = parsed.data;
  const repo = shiftTemplatesRepo(db);
  const active = await repo.listActive();

  const newDur = durationMin(start_time, end_time);
  const existingTotal = active.reduce((s, t) => s + durationMin(t.startTime, t.endTime), 0);
  if (existingTotal + newDur > 1440) {
    return NextResponse.json(
      { error: { code: 'DURATION_EXCEEDED', message: 'Tổng thời gian ca vượt quá 24 giờ', currentMin: existingTotal, limitMin: 1440 } },
      { status: 422 }
    );
  }

  for (const t of active) {
    if (timesOverlap(start_time, end_time, t.startTime, t.endTime)) {
      return NextResponse.json(
        { error: { code: 'OVERLAP', message: `Khung giờ trùng với ca "${t.name}"` } },
        { status: 422 }
      );
    }
  }

  const row = await repo.create({ name, shiftNumber: shift_number, startTime: start_time, endTime: end_time });
  return NextResponse.json(row, { status: 201 });
}
```

- [ ] **Step 2: Create `src/app/api/admin/shift-templates/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { shiftTemplatesRepo } from '@/server/repos/shiftTemplates';
import { requireRole } from '@/server/auth/guards';

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function durationMin(start: string, end: string): number {
  const s = timeToMin(start), e = timeToMin(end);
  return e > s ? e - s : 1440 - s + e;
}
function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const a = timeToMin(s1), b = timeToMin(e1), c = timeToMin(s2), d = timeToMin(e2);
  const inRange = (min: number, start: number, end: number) =>
    end > start ? min >= start && min < end : min >= start || min < end;
  return inRange(c, a, b) || inRange(a, c, d);
}

const UpdateBody = z.object({
  name:         z.string().min(1).max(64).optional(),
  shift_number: z.number().int().min(1).optional(),
  start_time:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  is_active:    z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;

  const id = Number(params.id);
  const repo = shiftTemplatesRepo(db);
  const existing = await repo.getById(id);
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy ca' } }, { status: 404 });
  }

  const parsed = UpdateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  }

  const { name, shift_number, start_time, end_time, is_active } = parsed.data;

  if (is_active !== undefined && is_active !== existing.isActive) {
    if (is_active) {
      const currentTotal = await repo.totalActiveDurationMin();
      if (currentTotal + durationMin(existing.startTime, existing.endTime) > 1440) {
        return NextResponse.json(
          { error: { code: 'DURATION_EXCEEDED', message: 'Tổng thời gian ca vượt quá 24 giờ' } },
          { status: 422 }
        );
      }
    }
    await repo.toggleActive(id, is_active);
  }

  if (start_time !== undefined || end_time !== undefined) {
    const newStart = start_time ?? existing.startTime;
    const newEnd = end_time ?? existing.endTime;
    const newDur = durationMin(newStart, newEnd);
    const otherTotal = await repo.totalActiveDurationMin(id);
    if (existing.isActive && otherTotal + newDur > 1440) {
      return NextResponse.json(
        { error: { code: 'DURATION_EXCEEDED', message: 'Tổng thời gian ca vượt quá 24 giờ', currentMin: otherTotal, limitMin: 1440 } },
        { status: 422 }
      );
    }
    const active = await repo.listActive();
    for (const t of active) {
      if (t.id === id) continue;
      if (timesOverlap(newStart, newEnd, t.startTime, t.endTime)) {
        return NextResponse.json(
          { error: { code: 'OVERLAP', message: `Khung giờ trùng với ca "${t.name}"` } },
          { status: 422 }
        );
      }
    }
  }

  const row = await repo.update(id, {
    ...(name !== undefined && { name }),
    ...(shift_number !== undefined && { shiftNumber: shift_number }),
    ...(start_time !== undefined && { startTime: start_time }),
    ...(end_time !== undefined && { endTime: end_time }),
  });

  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;
  const repo = shiftTemplatesRepo(db);
  const existing = await repo.getById(Number(params.id));
  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy ca' } }, { status: 404 });
  }
  await repo.delete(Number(params.id));
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck 2>&1 | grep -v node_modules
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/shift-templates/
git commit -m "feat: API routes for shift template CRUD with duration and overlap validation"
```

---

### Task 7: UI — strings, components, page

**Files:**
- Modify: `src/lib/strings.ts`
- Create: `src/components/admin/shift-coverage-bar.tsx`
- Create: `src/components/admin/shift-template-form.tsx`
- Create: `src/app/admin/shifts/page.tsx`
- Modify: `src/app/admin/workcenters/page.tsx`

- [ ] **Step 1: Add `shifts` key to `src/lib/strings.ts`**

Inside the `T` object, add after the `admin` key:

```ts
  shifts: {
    title: 'Quản lý ca làm việc',
    addShift: 'Thêm ca',
    active: 'Đang hoạt động',
    inactive: 'Tắt',
    enable: 'Bật',
    disable: 'Tắt',
    edit: 'Sửa',
    delete: 'Xoá',
    deleteConfirm: 'Xác nhận xoá ca này?',
    columns: { number: '#', name: 'Tên ca', start: 'Bắt đầu', end: 'Kết thúc', duration: 'Thời lượng', status: 'Trạng thái' },
    form: {
      createTitle: 'Thêm ca mới',
      editTitle: 'Sửa ca',
      name: 'Tên ca',
      shiftNumber: 'Số ca',
      startTime: 'Giờ bắt đầu',
      endTime: 'Giờ kết thúc',
      duration: 'Thời lượng',
      crossMidnight: '(qua nửa đêm)',
    }
  },
```

- [ ] **Step 2: Create `src/components/admin/shift-coverage-bar.tsx`**

```tsx
interface Template { startTime: string; endTime: string; name: string; isActive: boolean }

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function durMin(s: string, e: string) { const a = timeToMin(s), b = timeToMin(e); return b > a ? b - a : 1440 - a + b; }

const COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500'];

// Cross-midnight bars need two segments; returns [{left%, width%}]
function segments(startTime: string, endTime: string) {
  const s = timeToMin(startTime), dur = durMin(startTime, endTime);
  if (s + dur <= 1440) return [{ left: (s / 1440) * 100, width: (dur / 1440) * 100 }];
  return [
    { left: (s / 1440) * 100, width: ((1440 - s) / 1440) * 100 },
    { left: 0, width: ((s + dur - 1440) / 1440) * 100 },
  ];
}

export function ShiftCoverageBar({ templates }: { templates: Template[] }) {
  const active = templates.filter(t => t.isActive);
  const totalMin = active.reduce((s, t) => s + durMin(t.startTime, t.endTime), 0);
  const hasGap = totalMin < 1440;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Phủ sóng theo ngày</span>
        <span className={hasGap ? 'text-amber-500 font-medium' : 'text-green-500 font-medium'}>
          {(totalMin / 60).toFixed(1)}h / 24h {hasGap ? '⚠' : '✓'}
        </span>
      </div>
      <div className="relative h-3 rounded bg-muted overflow-hidden">
        {active.map((t, i) =>
          segments(t.startTime, t.endTime).map((seg, j) => (
            <div
              key={`${t.name}-${j}`}
              className={`absolute h-full ${COLORS[i % COLORS.length]} opacity-80`}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
              title={t.name}
            />
          ))
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {['00:00', '06:00', '12:00', '18:00', '24:00'].map(l => <span key={l}>{l}</span>)}
      </div>
      {hasGap && (
        <p className="text-xs text-amber-600">
          ⚠ {(1440 - totalMin) / 60}h chưa được lên lịch — sản phẩm ngoài ca sẽ tạo cảnh báo.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/admin/shift-template-form.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { T } from '@/lib/strings';

interface Template { id: number; name: string; shiftNumber: number; startTime: string; endTime: string }

function calcDuration(start: string, end: string): string {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  const min = e > s ? e - s : 1440 - s + e;
  const cross = e <= s;
  return `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}${cross ? ` ${T.shifts.form.crossMidnight}` : ''}`;
}

export function ShiftTemplateForm({ mode, template, trigger }: { mode: 'create' | 'edit'; template?: Template; trigger: React.ReactNode }) {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: template?.name ?? '',
    shift_number: String(template?.shiftNumber ?? ''),
    start_time: template?.startTime ?? '',
    end_time: template?.endTime ?? '',
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = mode === 'create' ? '/api/admin/shift-templates' : `/api/admin/shift-templates/${template!.id}`;
    const res = await fetch(url, {
      method: mode === 'create' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, shift_number: Number(form.shift_number), start_time: form.start_time, end_time: form.end_time }),
    });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      toast.error((r as { error?: { message?: string } })?.error?.message ?? T.common.error);
      return;
    }
    toast.success(T.dashboard.manualEntry.success);
    setOpen(false);
    await mutate('/api/admin/shift-templates');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? T.shifts.form.createTitle : T.shifts.form.editTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>{T.shifts.form.name}</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid gap-2">
            <Label>{T.shifts.form.shiftNumber}</Label>
            <Input type="number" min={1} value={form.shift_number} onChange={e => setForm({ ...form, shift_number: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{T.shifts.form.startTime}</Label>
              <Input placeholder="08:00" pattern="\d{2}:\d{2}" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>{T.shifts.form.endTime}</Label>
              <Input placeholder="16:00" pattern="\d{2}:\d{2}" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {T.shifts.form.duration}: <span className="font-medium text-foreground">{calcDuration(form.start_time, form.end_time)}</span>
          </p>
          <DialogFooter>
            <Button type="submit">{T.admin.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create `src/app/admin/shifts/page.tsx`**

```tsx
'use client';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';
import { HeaderBar } from '@/components/dashboard/header-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShiftCoverageBar } from '@/components/admin/shift-coverage-bar';
import { ShiftTemplateForm } from '@/components/admin/shift-template-form';
import { T } from '@/lib/strings';

interface ShiftTemplate { id: number; name: string; shiftNumber: number; startTime: string; endTime: string; isActive: boolean }

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  const min = e > s ? e - s : 1440 - s + e;
  return `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}`;
}

function isCrossMidnight(start: string, end: string): boolean {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em <= sh * 60 + sm;
}

export default function AdminShiftsPage() {
  const { data: templates } = useSWR<ShiftTemplate[]>('/api/admin/shift-templates', fetcher);
  const { data: dash } = useSWR<{ totals: { running: number; stopped: number; shiftQty: number } }>('/api/dashboard', fetcher, { refreshInterval: 30_000 });
  const { mutate } = useSWRConfig();

  async function toggleActive(t: ShiftTemplate) {
    const res = await fetch(`/api/admin/shift-templates/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.isActive }),
    });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      toast.error((r as { error?: { message?: string } })?.error?.message ?? T.common.error);
      return;
    }
    await mutate('/api/admin/shift-templates');
  }

  async function deleteTemplate(t: ShiftTemplate) {
    if (!confirm(T.shifts.deleteConfirm)) return;
    const res = await fetch(`/api/admin/shift-templates/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error(T.common.error); return; }
    await mutate('/api/admin/shift-templates');
  }

  return (
    <div>
      <HeaderBar totals={dash?.totals ?? { running: 0, stopped: 0, shiftQty: 0 }} />
      <main className="flex flex-col gap-4 p-6">
        <Link href="/admin/workcenters" className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
          ← {T.admin.title}
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{T.shifts.title}</CardTitle>
            <ShiftTemplateForm mode="create" trigger={<Button>{T.shifts.addShift}</Button>} />
          </CardHeader>
          <CardContent className="space-y-4">
            {templates && <ShiftCoverageBar templates={templates} />}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{T.shifts.columns.number}</TableHead>
                  <TableHead>{T.shifts.columns.name}</TableHead>
                  <TableHead>{T.shifts.columns.start}</TableHead>
                  <TableHead>{T.shifts.columns.end}</TableHead>
                  <TableHead>{T.shifts.columns.duration}</TableHead>
                  <TableHead>{T.shifts.columns.status}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(templates ?? []).map(t => (
                  <TableRow key={t.id} className={t.isActive ? '' : 'opacity-50'}>
                    <TableCell>{t.shiftNumber}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-sm">{t.startTime}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {t.endTime}
                      {isCrossMidnight(t.startTime, t.endTime) && (
                        <span className="ml-1 text-[10px] text-amber-500">+1</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{durationLabel(t.startTime, t.endTime)}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? 'default' : 'secondary'}>
                        {t.isActive ? T.shifts.active : T.shifts.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <ShiftTemplateForm mode="edit" template={t} trigger={<Button variant="secondary" size="sm">{T.shifts.edit}</Button>} />
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(t)}>
                          {t.isActive ? T.shifts.disable : T.shifts.enable}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteTemplate(t)}>
                          {T.shifts.delete}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Add link in `src/app/admin/workcenters/page.tsx`**

After the existing `backToDashboard` link, add:

```tsx
<Link
  href="/admin/shifts"
  className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
>
  → {T.shifts.title}
</Link>
```

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck 2>&1 | grep -v node_modules
```

Expected: no errors.

- [ ] **Step 7: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/strings.ts src/components/admin/shift-coverage-bar.tsx src/components/admin/shift-template-form.tsx src/app/admin/shifts/page.tsx src/app/admin/workcenters/page.tsx
git commit -m "feat: shift management UI — coverage bar, CRUD table, add/edit dialog"
```
