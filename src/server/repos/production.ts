import { sql, and, eq, max } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import type { Database } from '@/server/db/types';

export function productionRepo(db: Database) {
  return {
    insertPulse: (i: { workcenter_id: number; qty: number; time?: Date }) =>
      db.insert(schema.productionMetrics).values({
        time: i.time ?? new Date(),
        workcenterId: i.workcenter_id,
        qty: i.qty,
        source: 'sensor'
      }),

    insertManual: (i: { workcenter_id: number; qty: number; defect_qty?: number; reason?: string | null; time?: Date }) =>
      db.insert(schema.productionMetrics).values({
        time: i.time ?? new Date(),
        workcenterId: i.workcenter_id,
        qty: i.qty,
        defectQty: i.defect_qty ?? 0,
        source: 'manual',
        note: i.reason ?? null
      }),

    lastPulseAt: async (workcenter_id: number): Promise<Date | null> => {
      const [row] = await db
        .select({ t: max(schema.productionMetrics.time) })
        .from(schema.productionMetrics)
        .where(eq(schema.productionMetrics.workcenterId, workcenter_id));
      return row?.t ?? null;
    },

    qtyInRange: async (workcenter_id: number, from: Date, to: Date) => {
      const rows = await db.execute<{ qty: string; defect_qty: string }>(sql`
        SELECT COALESCE(SUM(qty), 0)::text AS qty,
               COALESCE(SUM(defect_qty), 0)::text AS defect_qty
        FROM production_metrics
        WHERE workcenter_id = ${workcenter_id}
          AND time >= ${from}
          AND time <  ${to}
      `);
      const r = rows.rows[0];
      return { qty: Number(r.qty), defectQty: Number(r.defect_qty) };
    },

    /** Hourly buckets across [from, to) grouped by workcenter. */
    hourlyAll: async (from: Date, to: Date) => {
      const { rows } = await db.execute<{ workcenter_id: number; hour_start: Date; qty: string; defect_qty: string }>(sql`
        SELECT workcenter_id,
               time_bucket('1 hour', time) AS hour_start,
               COALESCE(SUM(qty), 0)::text AS qty,
               COALESCE(SUM(defect_qty), 0)::text AS defect_qty
        FROM production_metrics
        WHERE time >= ${from} AND time < ${to}
        GROUP BY workcenter_id, hour_start
        ORDER BY hour_start ASC
      `);
      return rows.map((r) => ({ workcenterId: r.workcenter_id, hourStart: r.hour_start, qty: Number(r.qty), defectQty: Number(r.defect_qty) }));
    },

    hourlyForWorkcenter: async (workcenter_id: number, from: Date, to: Date) => {
      const { rows } = await db.execute<{ hour_start: Date; qty: string; defect_qty: string }>(sql`
        SELECT time_bucket('1 hour', time) AS hour_start,
               COALESCE(SUM(qty), 0)::text AS qty,
               COALESCE(SUM(defect_qty), 0)::text AS defect_qty
        FROM production_metrics
        WHERE workcenter_id = ${workcenter_id}
          AND time >= ${from} AND time < ${to}
        GROUP BY hour_start
        ORDER BY hour_start ASC
      `);
      return rows.map((r) => ({ hourStart: r.hour_start, qty: Number(r.qty), defectQty: Number(r.defect_qty) }));
    }
  };
}
