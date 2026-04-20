import { eq, asc } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import type { Database } from '@/server/db/types';

export function workcentersRepo(db: Database) {
  return {
    list: () => db.select().from(schema.workcenters).orderBy(asc(schema.workcenters.id)),
    get: async (id: number) => {
      const [row] = await db.select().from(schema.workcenters).where(eq(schema.workcenters.id, id)).limit(1);
      return row ?? null;
    },
    create: async (i: { code: string; name: string; target_qty_per_hour: number; alert_threshold_minutes?: number; low_output_threshold_pct?: number }) => {
      const [row] = await db.insert(schema.workcenters).values({
        code: i.code, name: i.name, targetQtyPerHour: i.target_qty_per_hour,
        alertThresholdMinutes: i.alert_threshold_minutes ?? 10,
        lowOutputThresholdPct: i.low_output_threshold_pct ?? 60
      }).returning();
      return row;
    },
    update: async (id: number, patch: Partial<{ name: string; target_qty_per_hour: number; alert_threshold_minutes: number; low_output_threshold_pct: number }>) => {
      const [row] = await db.update(schema.workcenters).set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.target_qty_per_hour !== undefined && { targetQtyPerHour: patch.target_qty_per_hour }),
        ...(patch.alert_threshold_minutes !== undefined && { alertThresholdMinutes: patch.alert_threshold_minutes }),
        ...(patch.low_output_threshold_pct !== undefined && { lowOutputThresholdPct: patch.low_output_threshold_pct }),
        updatedAt: new Date()
      }).where(eq(schema.workcenters.id, id)).returning();
      return row;
    }
  };
}
