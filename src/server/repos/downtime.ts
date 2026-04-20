import { and, eq, gte, lte, isNull, sql, desc } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import type { Database } from '@/server/db/types';

export function downtimeRepo(db: Database) {
  return {
    open: async (workcenter_id: number, startTime: Date) => {
      const [row] = await db.insert(schema.downtimeEvents)
        .values({ workcenterId: workcenter_id, startTime })
        .returning();
      return row;
    },
    getOpen: async (workcenter_id: number) => {
      const [row] = await db.select()
        .from(schema.downtimeEvents)
        .where(and(eq(schema.downtimeEvents.workcenterId, workcenter_id), isNull(schema.downtimeEvents.endTime)))
        .limit(1);
      return row ?? null;
    },
    close: async (id: number, endTime: Date) => {
      await db.update(schema.downtimeEvents).set({ endTime }).where(eq(schema.downtimeEvents.id, id));
    },
    list: async (filter: { from?: Date; to?: Date; workcenterId?: number }) => {
      const clauses = [] as Parameters<typeof and>[0][];
      if (filter.from) clauses.push(gte(schema.downtimeEvents.startTime, filter.from));
      if (filter.to) clauses.push(lte(schema.downtimeEvents.startTime, filter.to));
      if (filter.workcenterId) clauses.push(eq(schema.downtimeEvents.workcenterId, filter.workcenterId));
      const where = clauses.length > 0 ? and(...(clauses as [Parameters<typeof and>[0], ...Parameters<typeof and>])) : undefined;
      return db.select().from(schema.downtimeEvents).where(where).orderBy(desc(schema.downtimeEvents.startTime));
    },
    setReason: async (id: number, reason: string) => {
      await db.update(schema.downtimeEvents).set({ reason }).where(eq(schema.downtimeEvents.id, id));
    },
    /** Total minutes of downtime intersecting [from, to) for a workcenter. */
    minutesWithin: async (workcenter_id: number, from: Date, to: Date): Promise<number> => {
      const { rows } = await db.execute<{ mins: string }>(sql`
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(COALESCE(end_time, ${to}), ${to}) - GREATEST(start_time, ${from}))) / 60), 0)::text AS mins
        FROM downtime_events
        WHERE workcenter_id = ${workcenter_id}
          AND start_time < ${to}
          AND (end_time IS NULL OR end_time > ${from})
      `);
      return Math.max(0, Math.round(Number(rows[0].mins)));
    }
  };
}
