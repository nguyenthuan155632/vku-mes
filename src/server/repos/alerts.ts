import { and, eq, isNull, desc } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import type { Database } from '@/server/db/types';

export function alertsRepo(db: Database) {
  return {
    insert: async (i: { workcenter_id: number; type: 'silent_machine' | 'low_output' | 'unscheduled_production'; message: string }) => {
      const [row] = await db.insert(schema.alerts).values({
        workcenterId: i.workcenter_id, type: i.type, message: i.message
      }).returning();
      return row;
    },
    hasOpen: async (workcenter_id: number, type: 'silent_machine' | 'low_output' | 'unscheduled_production') => {
      const [row] = await db.select({ id: schema.alerts.id }).from(schema.alerts)
        .where(and(
          eq(schema.alerts.workcenterId, workcenter_id),
          eq(schema.alerts.type, type),
          isNull(schema.alerts.resolvedAt)
        ))
        .limit(1);
      return !!row;
    },
    list: async (status: 'open' | 'all') => {
      const q = db.select().from(schema.alerts);
      if (status === 'open') return q.where(isNull(schema.alerts.resolvedAt)).orderBy(desc(schema.alerts.triggeredAt));
      return q.orderBy(desc(schema.alerts.triggeredAt));
    },
    acknowledge: async (id: number) => {
      await db.update(schema.alerts).set({ resolvedAt: new Date(), resolvedBy: 'supervisor' }).where(eq(schema.alerts.id, id));
    }
  };
}
