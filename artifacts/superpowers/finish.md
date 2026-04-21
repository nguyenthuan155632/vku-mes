# Finish Summary — Sản lượng Detail Page

## What was built

A production output detail page accessible from the dashboard machine table. Users can now click any workcenter name to view detailed hourly production data.

## New files

| File | Purpose |
|---|---|
| `src/app/api/workcenters/[id]/output/route.ts` | API: returns hourly rows + totals for one workcenter |
| `src/components/output/output-chart.tsx` | Recharts bar chart (qty + defect) |
| `src/components/output/output-summary-cards.tsx` | 3 KPI cards (total qty, defect qty, defect rate) |
| `src/components/output/output-table.tsx` | Hourly data table sorted newest-first |
| `src/app/workcenters/[id]/output/page.tsx` | Detail page with time toggle (4h/8h/24h) |

## Modified files

| File | Change |
|---|---|
| `src/lib/strings.ts` | Added `T.output.*` Vietnamese label group + `T.dashboard.edit` |
| `src/components/dashboard/machine-row.tsx` | Name → `<Link>`, edit moved to `<Pencil>` icon button |
| `src/components/dashboard/machine-table.tsx` | Added empty `<TableHead>` for new action column |

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ **0 errors, 0 warnings** |
| No new npm dependencies | ✅ uses existing `recharts`, `date-fns-tz`, `lucide-react` |
| ManualEntryDialog preserved | ✅ triggered by ✏️ icon for operator/supervisor roles |

## UX behaviour

- **All roles**: workcenter name is a link → `/workcenters/{id}/output`
- **Operator / Supervisor**: pencil icon in last column opens manual entry dialog
- **Viewer**: no pencil icon visible
- Detail page auto-refreshes every 30 seconds; time range selector switches between 4h / 8h / 24h without page reload

## Manual validation steps

1. Start dev server: `npm run dev` (or `docker compose up`)  
2. Go to dashboard — confirm workcenter names are underline-on-hover links  
3. Click a name → should open `/workcenters/{id}/output`  
4. Verify page shows summary cards, bar chart, data table  
5. Toggle time range buttons (4h / 8h / 24h) — data should update  
6. Log in as `operator` — confirm ✏️ icon is visible; click it → ManualEntryDialog opens  
7. Log in as `viewer` — confirm ✏️ icon is hidden

## Follow-ups (optional)

- Add date-picker for custom time range beyond 24h
- Add PDF/CSV export of the hourly table
- Add target line on the bar chart (workcenter `targetQtyPerHour`)
