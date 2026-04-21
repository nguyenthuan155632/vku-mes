import cron from 'node-cron';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../server/db/schema';
import { workcentersRepo } from '../server/repos/workcenters';
import { productionRepo } from '../server/repos/production';
import { downtimeRepo } from '../server/repos/downtime';
import { shiftsRepo } from '../server/repos/shifts';
import { alertsRepo } from '../server/repos/alerts';
import { shiftTemplatesRepo } from '../server/repos/shiftTemplates';
import { detectDowntime } from '../server/engine/downtime';
import { checkLowOutput } from '../server/engine/alerts';
import { shiftWindowFor, type ShiftTemplate } from '../server/engine/shift';
import { computeOEE } from '../server/engine/oee';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

let templateCache: ShiftTemplate[] = [];
let templateCacheAt = new Date(0);
const CACHE_TTL_MS = 5 * 60_000;

async function getTemplates(): Promise<ShiftTemplate[]> {
  if (Date.now() - templateCacheAt.getTime() > CACHE_TTL_MS) {
    const rows = await shiftTemplatesRepo(db).listActive();
    templateCache = rows.map(r => ({
      id: r.id, name: r.name, shiftNumber: r.shiftNumber,
      startTime: r.startTime, endTime: r.endTime,
    }));
    templateCacheAt = new Date();
  }
  return templateCache;
}

let prevTickAt = new Date(0);

async function tick() {
  const now = new Date();
  const templates = await getTemplates();
  const wc = workcentersRepo(db);
  const prod = productionRepo(db);
  const dt = downtimeRepo(db);
  const alerts = alertsRepo(db);
  const workcenters = await wc.list();
  const currWin = shiftWindowFor(now, templates);

  for (const w of workcenters) {
    try {
      const [lastPulseAt, open] = await Promise.all([prod.lastPulseAt(w.id), dt.getOpen(w.id)]);
      const d = detectDowntime({
        workcenterId: w.id, lastPulseAt,
        openDowntime: open ? { id: open.id, startTime: open.startTime as Date } : null,
        alertThresholdMin: w.alertThresholdMinutes, now
      });
      if (typeof d.action !== 'string') {
        if (d.action.kind === 'open') await dt.open(w.id, d.action.startTime);
        else await dt.close(d.action.id, d.action.endTime);
      }
      if (d.alert) {
        const already = await alerts.hasOpen(w.id, 'silent_machine');
        if (!already) await alerts.insert({ workcenter_id: w.id, type: 'silent_machine', message: d.alert.message });
      }

      const lastHour = await prod.qtyInRange(w.id, new Date(now.getTime() - 3600_000), now);
      const hasOpenLow = await alerts.hasOpen(w.id, 'low_output');
      const l = checkLowOutput({
        workcenterId: w.id, lastHourQty: lastHour.qty,
        targetQtyPerHour: w.targetQtyPerHour, thresholdPct: w.lowOutputThresholdPct,
        hasOpenAlert: hasOpenLow
      });
      if (l.alert) await alerts.insert({ workcenter_id: w.id, type: 'low_output', message: l.alert.message });

      // Ghost production: pulses arriving outside all shift windows
      if (!currWin) {
        const tickStart = new Date(now.getTime() - 35_000);
        const recent = await prod.qtyInRange(w.id, tickStart, now);
        if (recent.qty > 0) {
          const already = await alerts.hasOpen(w.id, 'unscheduled_production');
          if (!already) {
            const fmt = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            await alerts.insert({
              workcenter_id: w.id, type: 'unscheduled_production',
              message: `${recent.qty} sản phẩm ghi nhận ${fmt(tickStart)}–${fmt(now)} — ngoài ca làm việc`
            });
          }
        }
      }
    } catch (err) {
      console.error(`[worker] workcenter ${w.id} tick failed`, err);
    }
  }

  // Shift rollover detection
  const prevWin = shiftWindowFor(prevTickAt, templates);
  const boundaryCrossed = prevTickAt.getTime() > 0
    && prevWin !== null
    && (currWin === null || prevWin.startsAt.getTime() !== currWin.startsAt.getTime());

  if (boundaryCrossed && prevWin) {
    console.log('[worker] shift boundary crossed, closing previous shifts');
    const sh = shiftsRepo(db);
    for (const w of workcenters) {
      const existing = await sh.upsertCurrent({
        workcenter_id: w.id, shift_date: prevWin.date,
        shift_number: prevWin.number, starts_at: prevWin.startsAt, ends_at: prevWin.endsAt
      });
      const totals = await prod.qtyInRange(w.id, prevWin.startsAt, prevWin.endsAt);
      const dtMin = await dt.minutesWithin(w.id, prevWin.startsAt, prevWin.endsAt);
      const runtime = Math.max(0, prevWin.shiftLengthMin - dtMin);
      const oee = computeOEE({
        shiftLengthMin: prevWin.shiftLengthMin, runtimeMin: runtime,
        totalQty: totals.qty, defectQty: totals.defectQty, targetQtyPerHour: w.targetQtyPerHour
      });
      await sh.close(existing.id, { totalQty: totals.qty, defectQty: totals.defectQty, runtimeMinutes: runtime, oeeScore: oee.oee });
    }
  }

  if (currWin) {
    const shCurr = shiftsRepo(db);
    for (const w of workcenters) {
      await shCurr.upsertCurrent({
        workcenter_id: w.id, shift_date: currWin.date,
        shift_number: currWin.number, starts_at: currWin.startsAt, ends_at: currWin.endsAt
      });
    }
  }

  prevTickAt = now;
}

console.log('[worker] starting, tick every 5s');
tick().catch((e) => console.error('[worker] initial tick failed', e));
cron.schedule('*/5 * * * * *', () => { tick().catch((e) => console.error('[worker] tick failed', e)); });
