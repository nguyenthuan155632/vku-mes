# Shift Management — Design Spec

**Date:** 2026-04-21
**Status:** Approved for implementation

---

## Problem

The current system hardcodes two 12-hour shifts (08:00–20:00, 20:00–08:00) in `src/server/engine/shift.ts`. This cannot be changed without a code deploy. Real factories need configurable shift windows — a factory with a single 8-hour day shift should not need a developer to change their schedule.

Additionally, production pulses that arrive outside any scheduled shift window are silently unattributed, with no way for supervisors to know this is happening.

---

## Decisions Made

| Question | Decision |
|---|---|
| Overtime concept? | Dropped. Supervisors simply add more shift templates. |
| Shift scope | Global — same schedule applies to all workcenters |
| Approach | DB-driven templates (Approach A) |
| Gap handling | Pulses always recorded; "ghost production" alert fires when pulses arrive outside all shift windows |
| Retroactive attribution | If a supervisor adds a shift template after the fact, the next shift close will attribute those pulses by time range |

---

## Data Model

### New table: `shift_templates`

```sql
CREATE TABLE shift_templates (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,               -- "Ca 1", "Ca 2"
  shift_number SMALLINT NOT NULL,           -- display/sort order
  start_time   TEXT NOT NULL,               -- "08:00" (HH:MM, Vietnam local)
  end_time     TEXT NOT NULL,               -- "17:00" (HH:MM, Vietnam local)
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Validation rules (enforced at API level):**
- Sum of durations of all `is_active` templates ≤ 1440 minutes
- Cross-midnight: if `end_time < start_time`, duration = (end − start + 1440 min)
- `shift_number` must be unique among active templates
- No two active templates may have overlapping time windows (API rejects with 422)

### Modified: `shifts` table

- `shiftNumber` TypeScript type: `number` (was `1 | 2`)
- No new columns needed — `shift_type` concept dropped

### Modified: `alertType` enum

```sql
ALTER TYPE alert_type ADD VALUE 'unscheduled_production';
```

---

## Engine: `src/server/engine/shift.ts`

Remove all hardcoded values (`SHIFT_LEN_MIN = 720`, hours `8` and `20`).

New signature:

```ts
type ShiftTemplate = {
  id: number;
  name: string;
  shiftNumber: number;
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
};

// Returns null when now falls in a gap (no active shift window)
export function shiftWindowFor(now: Date, templates: ShiftTemplate[]): ShiftWindow | null
```

- Iterates all templates, computes each window for the current day (handling cross-midnight)
- Returns the window whose `startsAt ≤ now < endsAt`
- Returns `null` if no template covers `now`
- `ShiftWindow.shiftLengthMin` is computed from template start/end (replaces `SHIFT_LENGTH_MIN` constant)

---

## Worker: `src/worker/index.ts`

1. **Template cache** — load `shift_templates WHERE is_active = true` once at startup; refresh every 5 minutes
2. **Null window handling** — if `shiftWindowFor(now, templates)` returns `null`, skip all shift open/close logic for this tick
3. **Ghost production detection** — after downtime check, if `shiftWindowFor` returned `null` AND any workcenter produced pulses in the last tick interval:
   - Check if an open `unscheduled_production` alert already exists for that workcenter
   - If not, insert one: `"X units recorded HH:MM–HH:MM — outside any scheduled shift window"`
4. **OEE denominator** — use `win.shiftLengthMin` from the window (not the removed `SHIFT_LENGTH_MIN` constant)
5. **Boundary detection** — unchanged logic; handles `null → non-null` and `non-null → null` transitions

---

## Repos

### New: `src/server/repos/shiftTemplates.ts`

```ts
shiftTemplatesRepo(db) {
  list(): ShiftTemplate[]                          // all templates ordered by shift_number
  listActive(): ShiftTemplate[]                    // is_active = true only
  create(input): ShiftTemplate
  update(id, input): ShiftTemplate
  toggleActive(id, isActive): void
  delete(id): void                                 // hard delete; historical shifts rows are unaffected (no FK)
  totalActiveDurationMin(): number                 // for validation
}
```

### Modified: `src/server/repos/shifts.ts`

- `upsertCurrent` — `shift_number` type widens to `number`
- No other changes

---

## API Routes

All under `/api/admin/shift-templates` — requires `supervisor` role.

| Method | Path | Action |
|---|---|---|
| GET | `/api/admin/shift-templates` | List all templates |
| POST | `/api/admin/shift-templates` | Create; validates total ≤ 1440 min |
| PUT | `/api/admin/shift-templates/[id]` | Update name / times; re-validates |
| PATCH | `/api/admin/shift-templates/[id]/toggle` | Toggle is_active |
| DELETE | `/api/admin/shift-templates/[id]` | Delete |

**Validation response (422):**
```json
{ "error": "Total active shift duration exceeds 24 hours", "currentMin": 1500, "limitMin": 1440 }
```

---

## UI: `/admin/shifts`

**Access:** supervisor role only (add to middleware guard).

**Components:**
- **Coverage bar** — 24h timeline showing active shift windows; amber highlight on gaps; total hours / 24h shown
- **Shift table** — columns: #, Name, Start, End, Duration, Status (Active/Inactive badge), Actions (Edit / Disable / Enable)
  - Cross-midnight end times labelled with `+1` (e.g. "01:00 +1")
- **Inline add/edit form** — appears above or below table; live duration preview; live total recalculation
- **Gap warning banner** — shown when total active coverage < 1440 min; lists gap periods

**Behaviour:**
- Disabling a template does not delete historical `shifts` rows
- Changes take effect on the worker's next template refresh (≤ 5 minutes)
- No confirmation required for enable/disable; confirmation dialog required for delete

---

## Alert: Ghost Production

**Type:** `unscheduled_production`

**Trigger:** Worker tick detects pulses in `production_metrics` during a period where `shiftWindowFor` returns `null`, and no open alert of this type exists for that workcenter.

**Alert message format:**
`"X units recorded HH:MM–HH:MM — outside any scheduled shift window"`

**Supervisor actions in Alert Feed:**
1. **Go to Shifts ↗** — navigates to `/admin/shifts` to add a covering template
2. **Dismiss** — resolves the alert; pulses remain in `production_metrics` unattributed

**Suppression:** Only one open `unscheduled_production` alert per workcenter at a time. Resolved when supervisor acts.

---

## Tests

- `tests/engine/shift.test.ts` — rewrite to pass templates array; add cases:
  - Single 8h shift, gap before and after
  - Cross-midnight shift
  - Two adjacent shifts (no gap)
  - Empty template list → always null
  - Now exactly at shift boundary (edge case)

---

## Implementation Order

```
1. DB migration: shift_templates table + alertType enum value
2. Engine: shift.ts refactor (pure, testable)
3. Tests: shift.test.ts
4. Repos: shiftTemplatesRepo + shifts.ts widened type
5. Worker: template cache + null window + ghost production alert
6. API routes: /api/admin/shift-templates
7. UI: /admin/shifts page
8. Navigation: add Shifts link to admin nav
```
