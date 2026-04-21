## Goal

Build a dedicated **"Sản lượng" (Production Output) Detail Page** that users can navigate to by clicking on a workcenter row in the `MachineTable`. The page should display rich, time-series production data for a single workcenter.

---

## Constraints

- **Next.js App Router** — must follow the existing `src/app/` routing conventions.
- **Authentication** — must reuse `requireRole` / `useAuth` guards; accessible to `operator`, `supervisor`, and `viewer` roles.
- **Data** — `productionRepo.hourlyForWorkcenter` already exists; the existing `/api/hourly` API only supports all-workcenter queries. A new per-workcenter endpoint is needed.
- **No breaking changes** — `MachineRow`'s existing click → `ManualEntryDialog` behavior (for `operator`/`supervisor`) must be preserved or coexist.
- **UI kit** — use existing shadcn/ui components (`Card`, `Table`, etc.) + Recharts (check if in deps) or a compatible chart lib for the time-series chart.
- **Vietnamese labels** — Follow existing `T` (strings) conventions.
- **TimescaleDB** — `time_bucket` is available; queries should stay efficient (no N+1).

---

## Known context

| Item | Detail |
|---|---|
| Route structure | `src/app/page.tsx` (dashboard), `src/app/supervisor/page.tsx`, `src/app/admin/`, etc. |
| Workcenter data | `id`, `code`, `name`, `status`, `shiftQty`, `hourly[]`, `runtimeMinutes`, `performancePct` |
| `productionRepo` | `hourlyForWorkcenter(id, from, to)` returns `{hourStart, qty, defectQty}[]` |
| Existing hourly API | `/api/hourly?hours=N` — all workcenters, no per-ID filter |
| `MachineRow` click | Opens `ManualEntryDialog` when `canEdit`. Currently no navigation link. |
| Auth | `requireRole([...])` on server; `useAuth()` on client |

---

## Risks

1. **Conflict in row click behavior** — The row already has `onClick → ManualEntryDialog`. Navigating away instead will break that. Need a deliberate UX decision.
2. **Large date ranges** — Querying months of hourly data can be heavy. Must cap range or paginate.
3. **Chart library** — If Recharts (or similar) isn't installed, an installation step is needed.
4. **Missing `workcenterId` query param** — The existing `/api/hourly` endpoint doesn't filter by workcenter; a new route or query-param extension is required.

---

## Options

### Option A — New route `/workcenters/[id]/output` + separate icon trigger
- Add a bar chart icon button in each `MachineRow` that navigates to `/workcenters/[id]/output`.
- Keeps existing `onClick → ManualEntryDialog` fully intact.
- **Pros:** cleanest UX separation, zero regression risk.
- **Cons:** adds an icon column.

### Option B — Extend `/api/hourly` with `?workcenterId=` and navigate on row click
- Add `workcenterId` query-param to existing `/api/hourly` route.
- Change `MachineRow` click to: open dialog if `canEdit`, navigate to detail page if not `canEdit`.
- **Pros:** reuses endpoint, less new code.
- **Cons:** splits click behavior by role (confusing).

### Option C — Modal / Drawer instead of a new page
- Click on "Sản lượng" badge area opens a full-screen drawer with the chart inside.
- **Pros:** stays in dashboard flow.
- **Cons:** less shareable URL, harder to extend later.

### Option D — New page navigated via workcenter name link
- Make the workcenter **name** a `<Link>` to `/workcenters/[id]/output`.
- Separate the `ManualEntryDialog` trigger to a dedicated ✏️ icon button.
- **Pros:** most intuitive pattern, URL-shareable, cleanly separates concerns.
- **Cons:** slightly more refactor of `MachineRow`.

---

## Recommendation

**Option D** — Make the workcenter name a `<Link>` and move the manual-entry trigger to an icon button.

Rationale:
- Named links to detail pages is the most expected web UX pattern.
- No conflict with `ManualEntryDialog` — gets a dedicated ✏️ edit icon.
- The detail page at `/workcenters/[id]/output` is URL-shareable and extensible.

---

## Acceptance criteria

- [ ] Clicking the workcenter name navigates to `/workcenters/[id]/output`.
- [ ] Accessible to roles: `operator`, `supervisor`, `viewer`.
- [ ] Page shows: name/code/status, time-range selector (4h/8h/24h), hourly bar chart (qty + defect), summary cards (total qty, defect qty, performance %), and raw data table.
- [ ] New API `GET /api/workcenters/[id]/output?hours=N` returns `{ workcenter, hourly[], totals }`.
- [ ] `ManualEntryDialog` moved to a ✏️ icon button (visible only to `canEdit`); behavior fully preserved.
- [ ] Page handles loading, empty-data, and error states.
- [ ] Vietnamese labels consistent with `T` strings pattern.
- [ ] No N+1 queries; uses `hourlyForWorkcenter` repo method.
- [ ] Mobile-responsive layout.
