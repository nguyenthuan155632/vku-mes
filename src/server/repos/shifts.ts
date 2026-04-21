import { and, eq } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import type { Database } from '@/server/db/types';

export function shiftsRepo(db: Database) {
  return {
    upsertCurrent: async (i: { workcenter_id: number; shift_date: string; shift_number: number; starts_at: Date; ends_at: Date }) => {
      // If a row exists, return it; otherwise insert.
      const existing = await db.select().from(schema.shifts)
        .where(and(
          eq(schema.shifts.workcenterId, i.workcenter_id),
          eq(schema.shifts.shiftDate, i.shift_date),
          eq(schema.shifts.shiftNumber, i.shift_number)
        ))
        .limit(1);
      if (existing[0]) return existing[0];
      const [row] = await db.insert(schema.shifts).values({
        workcenterId: i.workcenter_id,
        shiftDate: i.shift_date,
        shiftNumber: i.shift_number,
        startsAt: i.starts_at,
        endsAt: i.ends_at
      }).returning();
      return row;
    },
    close: async (id: number, totals: { totalQty: number; defectQty: number; runtimeMinutes: number; oeeScore: number }) => {
      await db.update(schema.shifts).set({
        totalQty: totals.totalQty,
        defectQty: totals.defectQty,
        runtimeMinutes: totals.runtimeMinutes,
        oeeScore: totals.oeeScore.toFixed(4),
        closedAt: new Date()
      }).where(eq(schema.shifts.id, id));
    }
  };
}
