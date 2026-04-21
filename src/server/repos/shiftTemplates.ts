import { and, eq, ne } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import type { Database } from '@/server/db/types';

function durationMin(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return e > s ? e - s : 1440 - s + e;
}

export function shiftTemplatesRepo(db: Database) {
  return {
    list: () =>
      db.select().from(schema.shiftTemplates).orderBy(schema.shiftTemplates.shiftNumber),

    listActive: () =>
      db.select().from(schema.shiftTemplates)
        .where(eq(schema.shiftTemplates.isActive, true))
        .orderBy(schema.shiftTemplates.shiftNumber),

    getById: async (id: number) => {
      const [row] = await db.select().from(schema.shiftTemplates)
        .where(eq(schema.shiftTemplates.id, id));
      return row ?? null;
    },

    totalActiveDurationMin: async (excludeId?: number): Promise<number> => {
      const rows = await db.select().from(schema.shiftTemplates)
        .where(excludeId !== undefined
          ? and(eq(schema.shiftTemplates.isActive, true), ne(schema.shiftTemplates.id, excludeId))
          : eq(schema.shiftTemplates.isActive, true));
      return rows.reduce((sum, r) => sum + durationMin(r.startTime, r.endTime), 0);
    },

    create: async (input: { name: string; shiftNumber: number; startTime: string; endTime: string }) => {
      const [row] = await db.insert(schema.shiftTemplates).values(input).returning();
      return row;
    },

    update: async (id: number, input: { name?: string; shiftNumber?: number; startTime?: string; endTime?: string }) => {
      const [row] = await db.update(schema.shiftTemplates).set(input)
        .where(eq(schema.shiftTemplates.id, id)).returning();
      return row ?? null;
    },

    toggleActive: async (id: number, isActive: boolean) => {
      await db.update(schema.shiftTemplates).set({ isActive })
        .where(eq(schema.shiftTemplates.id, id));
    },

    delete: async (id: number) => {
      await db.delete(schema.shiftTemplates).where(eq(schema.shiftTemplates.id, id));
    },
  };
}
