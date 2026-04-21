import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { workcentersRepo } from '@/server/repos/workcenters';
import { productionRepo } from '@/server/repos/production';
import { requireRole } from '@/server/auth/guards';
import { formatInTimeZone } from 'date-fns-tz';

const VN_TZ = 'Asia/Ho_Chi_Minh';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;

  const { id: idStr } = params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } }, { status: 400 });
  }

  const url = new URL(req.url);
  const hours = Math.min(24, Math.max(1, Number(url.searchParams.get('hours') ?? '8')));

  const wc = await workcentersRepo(db).get(id);
  if (!wc) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy máy' } }, { status: 404 });
  }

  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600_000);

  const rawRows = await productionRepo(db).hourlyForWorkcenter(id, from, to);

  const hourly = rawRows.map((r) => ({
    hourStart: r.hourStart instanceof Date ? r.hourStart.toISOString() : String(r.hourStart),
    label: formatInTimeZone(new Date(r.hourStart), VN_TZ, 'HH:mm dd/MM'),
    qty: r.qty,
    defectQty: r.defectQty
  })).reverse(); // newest first

  const totals = rawRows.reduce(
    (acc, r) => ({ qty: acc.qty + r.qty, defectQty: acc.defectQty + r.defectQty }),
    { qty: 0, defectQty: 0 }
  );

  return NextResponse.json({
    workcenter: { id: wc.id, code: wc.code, name: wc.name, targetQtyPerHour: wc.targetQtyPerHour },
    hours,
    from: from.toISOString(),
    to: to.toISOString(),
    hourly,
    totals
  });
}
