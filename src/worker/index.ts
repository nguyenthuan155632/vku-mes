import cron from 'node-cron';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../server/db/schema';
import { workcentersRepo } from '../server/repos/workcenters';
import { productionRepo } from '../server/repos/production';
import { downtimeRepo } from '../server/repos/downtime';
import { shiftsRepo } from '../server/repos/shifts';
import { alertsRepo } from '../server/repos/alerts';
import { detectDowntime } from '../server/engine/downtime';
import { checkLowOutput } from '../server/engine/alerts';
import { shiftWindowFor, SHIFT_LENGTH_MIN } from '../server/engine/shift';
import { computeOEE } from '../server/engine/oee';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

let prevTickAt = new Date(0);

async function tick() {
  const now = new Date();
  const wc = workcentersRepo(db);
  const prod = productionRepo(db);
  const dt = downtimeRepo(db);
  const alerts = alertsRepo(db);

  const workcenters = await wc.list();

  for (const w of workcenters) {
    try {
      const [lastPulseAt, open] = await Promise.all([prod.lastPulseAt(w.id), dt.getOpen(w.id)]);
      const d = detectDowntime({
        workcenterId: w.id,
        lastPulseAt,
        openDowntime: open ? { id: open.id, startTime: open.startTime as Date } : null,
        alertThresholdMin: w.alertThresholdMinutes,
        now
      });
      if (typeof d.action !== 'string') {
        if (d.action.kind === 'open') {
          await dt.open(w.id, d.action.startTime);
        } else {
          await dt.close(d.action.id, d.action.endTime);
        }
      }
      if (d.alert) {
        const already = await alerts.hasOpen(w.id, 'silent_machine');
        if (!already) await alerts.insert({ workcenter_id: w.id, type: 'silent_machine', message: d.alert.message });
      }

      // Low output check
      const lastHour = await prod.qtyInRange(w.id, new Date(now.getTime() - 3600_000), now);
      const hasOpenLow = await alerts.hasOpen(w.id, 'low_output');
      const l = checkLowOutput({
        workcenterId: w.id,
        lastHourQty: lastHour.qty,
        targetQtyPerHour: w.targetQtyPerHour,
        thresholdPct: w.lowOutputThresholdPct,
        hasOpenAlert: hasOpenLow
      });
      if (l.alert) await alerts.insert({ workcenter_id: w.id, type: 'low_output', message: l.alert.message });
    } catch (err) {
      console.error(`[worker] workcenter ${w.id} tick failed`, err);
    }
  }

  // Shift rollover detection
  const prevWin = shiftWindowFor(prevTickAt);
  const currWin = shiftWindowFor(now);
  const boundaryCrossed = prevTickAt.getTime() > 0 && prevWin.startsAt.getTime() !== currWin.startsAt.getTime();
  if (boundaryCrossed) {
    console.log('[worker] shift boundary crossed, closing previous shifts');
    const sh = shiftsRepo(db);
    for (const w of workcenters) {
      const existing = await sh.upsertCurrent({
        workcenter_id: w.id,
        shift_date: prevWin.date,
        shift_number: prevWin.number,
        starts_at: prevWin.startsAt,
        ends_at: prevWin.endsAt
      });
      const totals = await prod.qtyInRange(w.id, prevWin.startsAt, prevWin.endsAt);
      const dtMin = await dt.minutesWithin(w.id, prevWin.startsAt, prevWin.endsAt);
      const runtime = Math.max(0, SHIFT_LENGTH_MIN - dtMin);
      const oee = computeOEE({
        shiftLengthMin: SHIFT_LENGTH_MIN,
        runtimeMin: runtime,
        totalQty: totals.qty,
        defectQty: totals.defectQty,
        targetQtyPerHour: w.targetQtyPerHour
      });
      await sh.close(existing.id, { totalQty: totals.qty, defectQty: totals.defectQty, runtimeMinutes: runtime, oeeScore: oee.oee });
    }
  }

  // Ensure current-shift row exists for each workcenter
  const shCurr = shiftsRepo(db);
  for (const w of workcenters) {
    await shCurr.upsertCurrent({
      workcenter_id: w.id,
      shift_date: currWin.date,
      shift_number: currWin.number,
      starts_at: currWin.startsAt,
      ends_at: currWin.endsAt
    });
  }

  prevTickAt = now;
}

console.log('[worker] starting, tick every 30s');
tick().catch((e) => console.error('[worker] initial tick failed', e));
cron.schedule('*/30 * * * * *', () => { tick().catch((e) => console.error('[worker] tick failed', e)); });
