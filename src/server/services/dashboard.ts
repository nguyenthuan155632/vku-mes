import 'server-only';
import { sql } from 'drizzle-orm';
import type { Database } from '@/server/db/types';
import { workcentersRepo } from '@/server/repos/workcenters';
import { productionRepo } from '@/server/repos/production';
import { downtimeRepo } from '@/server/repos/downtime';
import { shiftWindowFor, SHIFT_LENGTH_MIN } from '@/server/engine/shift';
import { bucketHourly } from '@/server/engine/hourly';
import { computeOEE } from '@/server/engine/oee';

export interface DashboardPayload {
  now: string;
  shiftWindow: { date: string; number: 1 | 2; startsAt: string; endsAt: string };
  totals: { running: number; stopped: number; shiftQty: number };
  workcenters: Array<{
    id: number;
    code: string;
    name: string;
    status: 'running' | 'stopped';
    shiftQty: number;
    shiftDefectQty: number;
    hourly: Array<{ label: string; qty: number }>;
    runtimeMinutes: number;
    performancePct: number;
  }>;
}

export async function buildDashboard(db: Database, now = new Date()): Promise<DashboardPayload> {
  const wc = workcentersRepo(db);
  const prod = productionRepo(db);
  const dt = downtimeRepo(db);
  const workcenters = await wc.list();
  const shift = shiftWindowFor(now);
  const fourHoursAgo = new Date(now.getTime() - 4 * 3600_000);

  // All-in-one queries (no N+1): shift aggregate and hourly bucket across all workcenters
  const shiftAgg = await db.execute<{ workcenter_id: number; qty: string; defect_qty: string }>(sql`
    SELECT workcenter_id,
           COALESCE(SUM(qty), 0)::text AS qty,
           COALESCE(SUM(defect_qty), 0)::text AS defect_qty
    FROM production_metrics
    WHERE time >= ${shift.startsAt} AND time < ${now}
    GROUP BY workcenter_id
  `);

  const hourly = await prod.hourlyAll(fourHoursAgo, now);

  const openDowns = await db.execute<{ workcenter_id: number }>(sql`
    SELECT workcenter_id FROM downtime_events WHERE end_time IS NULL
  `);
  const stoppedIds = new Set(openDowns.rows.map((r) => r.workcenter_id));

  // For each workcenter compute runtime minutes (elapsed shift - downtime within shift)
  const elapsedMin = Math.min(SHIFT_LENGTH_MIN, Math.max(0, Math.round((now.getTime() - shift.startsAt.getTime()) / 60_000)));

  const perWcDowntime = new Map<number, number>();
  for (const w of workcenters) {
    perWcDowntime.set(w.id, await dt.minutesWithin(w.id, shift.startsAt, now));
  }

  const shiftRowByWc = new Map<number, { qty: number; defect: number }>();
  for (const r of shiftAgg.rows) shiftRowByWc.set(r.workcenter_id, { qty: Number(r.qty), defect: Number(r.defect_qty) });

  const workcenterPayload = workcenters.map((w) => {
    const agg = shiftRowByWc.get(w.id) ?? { qty: 0, defect: 0 };
    const hourlyRows = hourly.filter((h) => h.workcenterId === w.id).map((h) => ({ time: new Date(h.hourStart), qty: h.qty }));
    const buckets = bucketHourly(hourlyRows, now, 4).map((b) => ({ label: b.hourLabel, qty: b.qty }));
    const runtimeMinutes = Math.max(0, elapsedMin - (perWcDowntime.get(w.id) ?? 0));
    const oee = computeOEE({
      shiftLengthMin: SHIFT_LENGTH_MIN,
      runtimeMin: runtimeMinutes,
      totalQty: agg.qty,
      defectQty: agg.defect,
      targetQtyPerHour: w.targetQtyPerHour
    });
    return {
      id: w.id, code: w.code, name: w.name,
      status: stoppedIds.has(w.id) ? ('stopped' as const) : ('running' as const),
      shiftQty: agg.qty, shiftDefectQty: agg.defect,
      hourly: buckets,
      runtimeMinutes,
      performancePct: oee.oee
    };
  });

  const running = workcenterPayload.filter((w) => w.status === 'running').length;
  const stopped = workcenterPayload.length - running;

  return {
    now: now.toISOString(),
    shiftWindow: { date: shift.date, number: shift.number, startsAt: shift.startsAt.toISOString(), endsAt: shift.endsAt.toISOString() },
    totals: { running, stopped, shiftQty: workcenterPayload.reduce((s, w) => s + w.shiftQty, 0) },
    workcenters: workcenterPayload
  };
}
