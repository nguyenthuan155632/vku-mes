import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { productionRepo } from '@/server/repos/production';
import { requireRole } from '@/server/auth/guards';

export async function GET(req: Request) {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;
  const url = new URL(req.url);
  const hours = Math.min(24, Math.max(1, Number(url.searchParams.get('hours') ?? '8')));
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3600_000);
  const rows = await productionRepo(db).hourlyAll(from, to);
  return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), hours, rows });
}
