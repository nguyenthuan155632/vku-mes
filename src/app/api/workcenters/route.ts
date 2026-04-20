import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { workcentersRepo } from '@/server/repos/workcenters';
import { requireRole } from '@/server/auth/guards';

export async function GET() {
  const role = await requireRole(['operator', 'supervisor', 'viewer']);
  if (role instanceof NextResponse) return role;
  return NextResponse.json(await workcentersRepo(db).list());
}

const CreateBody = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  target_qty_per_hour: z.number().int().min(0),
  alert_threshold_minutes: z.number().int().min(1).max(240).optional(),
  low_output_threshold_pct: z.number().int().min(0).max(100).optional()
});

export async function POST(req: Request) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  try {
    const row = await workcentersRepo(db).create(parsed.data);
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') return NextResponse.json({ error: { code: 'CONFLICT', message: 'Mã máy đã tồn tại' } }, { status: 409 });
    throw e;
  }
}
