import { pgTable, serial, text, integer, smallint, boolean, timestamp, pgEnum, numeric, date, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const pulseSource = pgEnum('pulse_source', ['sensor', 'manual']);
export const alertType   = pgEnum('alert_type',   ['silent_machine', 'low_output', 'unscheduled_production']);
export const userRole    = pgEnum('user_role',    ['operator', 'supervisor', 'viewer']);

export const workcenters = pgTable('workcenters', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  targetQtyPerHour: integer('target_qty_per_hour').notNull(),
  alertThresholdMinutes: integer('alert_threshold_minutes').notNull().default(10),
  lowOutputThresholdPct: integer('low_output_threshold_pct').notNull().default(60),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const productionMetrics = pgTable('production_metrics', {
  time: timestamp('time', { withTimezone: true }).notNull(),
  workcenterId: integer('workcenter_id').notNull().references(() => workcenters.id),
  qty: integer('qty').notNull(),
  defectQty: integer('defect_qty').notNull().default(0),
  source: pulseSource('source').notNull(),
  note: text('note')
}, (t) => ({
  pk: uniqueIndex('production_metrics_pkey').on(t.time, t.workcenterId),
  wcTime: index().on(t.workcenterId, t.time)
}));

export const downtimeEvents = pgTable('downtime_events', {
  id: serial('id').primaryKey(),
  workcenterId: integer('workcenter_id').notNull().references(() => workcenters.id),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  reason: text('reason')
});

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  workcenterId: integer('workcenter_id').notNull().references(() => workcenters.id),
  shiftDate: date('shift_date').notNull(),
  shiftNumber: smallint('shift_number').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  totalQty: integer('total_qty').notNull().default(0),
  defectQty: integer('defect_qty').notNull().default(0),
  runtimeMinutes: integer('runtime_minutes').notNull().default(0),
  oeeScore: numeric('oee_score', { precision: 5, scale: 4 }),
  closedAt: timestamp('closed_at', { withTimezone: true })
});

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  workcenterId: integer('workcenter_id').notNull().references(() => workcenters.id),
  type: alertType('type').notNull(),
  message: text('message').notNull(),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: userRole('resolved_by')
});

export const shiftTemplates = pgTable('shift_templates', {
  id:          serial('id').primaryKey(),
  name:        text('name').notNull(),
  shiftNumber: smallint('shift_number').notNull(),
  startTime:   text('start_time').notNull(),
  endTime:     text('end_time').notNull(),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
