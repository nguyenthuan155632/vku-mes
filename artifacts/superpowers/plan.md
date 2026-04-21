## Goal

Build a **"Sản lượng" (Production Output) Detail Page** per workcenter that any authenticated user can navigate to from the dashboard's `MachineTable`. The page shows a time-series bar chart, summary cards, and a raw hourly data table for a single workcenter.

---

## Assumptions

- `recharts@^2.13.3` is already installed — no new dependencies needed.
- `formatInTimeZone` from `date-fns-tz` is already in use — safe to reuse.
- `workcentersRepo(db).get(id)` already exists for fetching one workcenter.
- `productionRepo(db).hourlyForWorkcenter(id, from, to)` already exists for hourly data.
- The new detail page follows the same `'use client'` + `useSWR` pattern as other pages.
- `ManualEntryDialog` behavior must be preserved — only the trigger UI changes.
- Default time window on the detail page: **8 hours**; selectable: 4h / 8h / 24h.
- `requireRole(['operator', 'supervisor', 'viewer'])` guards the new API.

---

## Plan

### Step 1 — Add `output` strings to `T` in `src/lib/strings.ts`
**Files:** `src/lib/strings.ts`
**Change:** Add a new `output` key to `T` with Vietnamese labels for the detail page (page title, time selector, chart labels, table headers, summary card labels).
**Verify:** `grep "output" src/lib/strings.ts` shows new keys; TypeScript compiles: `pnpm tsc --noEmit`.

---

### Step 2 — Create new API route `GET /api/workcenters/[id]/output`
**Files:** `src/app/api/workcenters/[id]/output/route.ts` [NEW]
**Change:**
- Accept `?hours=N` (default 8, max 24).
- Call `workcentersRepo(db).get(id)` — return 404 if not found.
- Call `productionRepo(db).hourlyForWorkcenter(id, from, to)`.
- Compute totals (`qty`, `defectQty`) from the hourly rows.
- Return `{ workcenter: { id, code, name, targetQtyPerHour }, hourly: [{hourStart, qty, defectQty, label}], totals: { qty, defectQty } }`.
- Guard with `requireRole(['operator', 'supervisor', 'viewer'])`.

**Verify:** `curl -s "http://localhost:3000/api/workcenters/1/output?hours=8"` returns JSON (requires running dev server).

---

### Step 3 — Create `OutputChart` component
**Files:** `src/components/output/output-chart.tsx` [NEW]
**Change:** Client component using Recharts `BarChart` with two bars (Sản lượng in blue #60a5fa, Phế phẩm in red #f87171). Props: `hourly: {label: string; qty: number; defectQty: number}[]`. Follows the same styling pattern as `src/components/supervisor/hourly-chart.tsx`.
**Verify:** `pnpm tsc --noEmit` passes.

---

### Step 4 — Create `OutputSummaryCards` component
**Files:** `src/components/output/output-summary-cards.tsx` [NEW]
**Change:** Client component showing 3 Cards: total qty, defect qty, defect rate (defectQty / qty). Uses `fmtNum` and `fmtPct`. Props: `totals: { qty: number; defectQty: number }`.
**Verify:** `pnpm tsc --noEmit` passes.

---

### Step 5 — Create `OutputTable` component
**Files:** `src/components/output/output-table.tsx` [NEW]
**Change:** Client component rendering a shadcn Table with columns: Giờ | Sản lượng | Phế phẩm | Tỷ lệ phế. Sorted descending (most recent first). Props: same `hourly[]` array.
**Verify:** `pnpm tsc --noEmit` passes.

---

### Step 6 — Create the detail page `src/app/workcenters/[id]/output/page.tsx`
**Files:** `src/app/workcenters/[id]/output/page.tsx` [NEW]
**Change:**
- `'use client'` + `useAuth()` guard (redirect if no role).
- State: `hours` (4 | 8 | 24), default 8.
- `useSWR` on `/api/workcenters/${id}/output?hours=${hours}`.
- Layout: `HeaderBar` at top, then back-link ← Dashboard, workcenter name/code/status badge, time-range toggle buttons (4h / 8h / 24h), `OutputSummaryCards`, `OutputChart`, `OutputTable`.
- Handles loading and error states.

**Verify:** Navigate to `http://localhost:3000/workcenters/1/output` — page renders without errors.

---

### Step 7 — Modify `MachineRow` to add name link + move edit trigger to icon
**Files:** `src/components/dashboard/machine-row.tsx`
**Change:**
- Wrap `wc.name` in `<Link href={/workcenters/${wc.id}/output}>` (imports `next/link`).
- Remove `onClick` from `<TableRow>`.
- Add a pencil icon button (Pencil from lucide-react) visible only when `canEdit` — clicking it calls `setOpen(true)`.
- `ManualEntryDialog` remains unchanged.

**Verify:** Clicking the workcenter name navigates to the detail page; clicking the pencil icon still opens the dialog.

---

### Step 8 — (Optional) Add `MachineTable` header for the edit column
**Files:** `src/components/dashboard/machine-table.tsx`
**Change:** If a new action column header is needed, add an empty `<TableHead />` to match the new layout.
**Verify:** Table columns align correctly in the browser.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Row click regression (dialog no longer opens on row click) | Step 7 moves trigger to explicit pencil icon — zero regression risk |
| TimescaleDB `time_bucket` not available in all envs | `hourlyForWorkcenter` already uses it; no change to query strategy |
| Large `hours` values causing slow queries | Cap at 24h in the API route (already done for `/api/hourly`) |
| `params.id` being a promise in Next.js 15 | Use `await params` or cast correctly; follow pattern in existing `[id]/route.ts` |
| `'use client'` boundary with `HeaderBar` | `HeaderBar` is already used in client pages; no issue |

---

## Rollback plan

All changes are additive (new files) except `machine-row.tsx`. To rollback:
1. Delete `src/app/workcenters/` directory.
2. Delete `src/app/api/workcenters/[id]/output/` directory.
3. Delete `src/components/output/` directory.
4. Revert `src/components/dashboard/machine-row.tsx` to original.
5. Revert `src/lib/strings.ts` new keys.

Git one-liner:
```
git checkout src/components/dashboard/machine-row.tsx src/lib/strings.ts && git clean -fd src/app/workcenters src/app/api/workcenters/\\[id\\]/output src/components/output
```
