# Execution Log — Sản lượng Detail Page

## Step 1 — Add `output` strings to `src/lib/strings.ts`
**Files:** `src/lib/strings.ts`
- Added `T.output` key with Vietnamese labels (title, back, timeRange, hours, chart, cards, table, legend)
- Added `T.dashboard.edit` for the pencil icon tooltip
**Verify:** `grep "output" src/lib/strings.ts` ✅ shows new keys
**Result:** ✅ PASS — tsc --noEmit clean

---

## Step 2 — Create `GET /api/workcenters/[id]/output`
**Files:** `src/app/api/workcenters/[id]/output/route.ts` [NEW]
- Guards with `requireRole(['operator', 'supervisor', 'viewer'])`
- Accepts `?hours=N` (default 8, capped at 24)
- Returns `{ workcenter, hours, from, to, hourly[], totals }` 
- Hourly rows returned newest-first; uses `productionRepo.hourlyForWorkcenter`
**Result:** ✅ PASS — tsc --noEmit clean

---

## Step 3 — Create `OutputChart` component
**Files:** `src/components/output/output-chart.tsx` [NEW]
- Recharts `BarChart` with qty (blue #60a5fa) and defectQty (red #f87171) bars
- Reverses hourly data for oldest→newest left-to-right display
- Dark-theme tooltip matching existing supervisor chart styling
**Result:** ✅ PASS — tsc --noEmit clean

---

## Step 4 — Create `OutputSummaryCards` component
**Files:** `src/components/output/output-summary-cards.tsx` [NEW]
- 3 KPI cards: total qty (blue), defect qty (red), defect rate (amber if >5%, else green)
- Uses `fmtNum` and `fmtPct` from existing format lib
**Result:** ✅ PASS — tsc --noEmit clean

---

## Step 5 — Create `OutputTable` component
**Files:** `src/components/output/output-table.tsx` [NEW]
- shadcn Table with columns: Giờ | Sản lượng | Phế phẩm | Tỷ lệ phế
- Data newest-first (from API); defect rate highlighted amber when >5%
- Empty state handled with Vietnamese message
**Result:** ✅ PASS — tsc --noEmit clean

---

## Step 6 — Create detail page `src/app/workcenters/[id]/output/page.tsx`
**Files:** `src/app/workcenters/[id]/output/page.tsx` [NEW]
- `'use client'` + `use(params)` for Next.js 15 async params
- `useSWR` with 30s refresh + `keepPreviousData` for smooth time-range switching
- Time-range toggle: 4h / 8h / 24h
- Skeleton `animate-pulse` loading states for cards, chart, table
- SharedHeaderBar reuses `/api/dashboard` data
**Result:** ✅ PASS — tsc --noEmit clean

---

## Step 7 — Modify `MachineRow`
**Files:** `src/components/dashboard/machine-row.tsx` [MODIFIED]
- Removed `onClick` from `<TableRow>`
- Wrapped `wc.name` in `<Link href=/workcenters/${wc.id}/output>`
- Added `<Button variant="ghost" size="icon">` with `<Pencil>` icon (visible only when `canEdit`)
- `ManualEntryDialog` remains; triggered by pencil button only
**Result:** ✅ PASS — tsc --noEmit clean

---

## Step 8 — Update `MachineTable` header
**Files:** `src/components/dashboard/machine-table.tsx` [MODIFIED]
- Added empty `<TableHead className="w-10" />` to align with new action column
**Result:** ✅ PASS — tsc --noEmit clean

---

## Final TypeScript Verification
Command: `/opt/homebrew/bin/node ./node_modules/typescript/bin/tsc --noEmit`
Result: ✅ **No errors, no warnings** — clean compile
