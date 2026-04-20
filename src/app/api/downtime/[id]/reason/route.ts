import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db/client';
import { downtimeRepo } from '@/server/repos/downtime';
import { requireRole } from '@/server/auth/guards';

const Body = z.object({ reason: z.string().max(500) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' } }, { status: 400 });
  await downtimeRepo(db).setReason(id, parsed.data.reason);
  return new NextResponse(null, { status: 200 });
}
