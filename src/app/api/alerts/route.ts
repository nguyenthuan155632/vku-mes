import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { alertsRepo } from '@/server/repos/alerts';
import { requireRole } from '@/server/auth/guards';

export async function GET(req: Request) {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;
  const status = (new URL(req.url).searchParams.get('status') ?? 'open') as 'open' | 'all';
  return NextResponse.json(await alertsRepo(db).list(status === 'all' ? 'all' : 'open'));
}
