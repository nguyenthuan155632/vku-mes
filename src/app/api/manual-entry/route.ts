import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { productionRepo } from '@/server/repos/production';
import { requireRole } from '@/server/auth/guards';

const Body = z.object({
  workcenter_id: z.number().int().positive(),
  qty: z.number().int(),
  defect_qty: z.number().int().min(0).optional(),
  reason: z.string().max(500).optional()
});

export async function POST(req: Request) {
  const role = await requireRole(['operator', 'supervisor']);
  if (role instanceof NextResponse) return role;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  const d = parsed.data;
  if (d.qty < 0) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Số lượng phải ≥ 0' } }, { status: 400 });
  await productionRepo(db).insertManual({
    workcenter_id: d.workcenter_id,
    qty: d.qty,
    defect_qty: d.defect_qty ?? 0,
    reason: d.reason ?? null
  });
  return new NextResponse(null, { status: 201 });
}
