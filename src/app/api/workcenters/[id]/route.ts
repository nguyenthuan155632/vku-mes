import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { workcentersRepo } from '@/server/repos/workcenters';
import { requireRole } from '@/server/auth/guards';

const Patch = z.object({
  name: z.string().min(1).max(128).optional(),
  target_qty_per_hour: z.number().int().min(0).optional(),
  alert_threshold_minutes: z.number().int().min(1).max(240).optional(),
  low_output_threshold_pct: z.number().int().min(0).max(100).optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } }, { status: 400 });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  const row = await workcentersRepo(db).update(id, parsed.data);
  if (!row) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy' } }, { status: 404 });
  return NextResponse.json(row);
}
