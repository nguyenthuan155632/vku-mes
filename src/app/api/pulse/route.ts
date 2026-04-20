import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { productionRepo } from '@/server/repos/production';
import { requirePulseToken } from '@/server/auth/guards';

const Body = z.object({
  workcenter_id: z.number().int().positive(),
  qty: z.number().int().min(0),
  source: z.literal('sensor')
});

export async function POST(req: Request) {
  const auth = requirePulseToken(req);
  if (auth !== true) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  await productionRepo(db).insertPulse({ workcenter_id: parsed.data.workcenter_id, qty: parsed.data.qty });
  return new NextResponse(null, { status: 201 });
}
