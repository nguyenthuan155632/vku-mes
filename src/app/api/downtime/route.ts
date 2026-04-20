import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { downtimeRepo } from '@/server/repos/downtime';
import { requireRole } from '@/server/auth/guards';

export async function GET(req: Request) {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;
  const url = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 24 * 3600_000);
  const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : defaultFrom;
  const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : now;
  const workcenterId = url.searchParams.get('workcenter_id') ? Number(url.searchParams.get('workcenter_id')) : undefined;
  const rows = await downtimeRepo(db).list({ from, to, workcenterId });
  return NextResponse.json(rows);
}
