import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { requireRole } from '@/server/auth/guards';
import { buildDashboard } from '@/server/services/dashboard';

export async function GET() {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;
  const payload = await buildDashboard(db);
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
