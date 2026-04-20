import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { alertsRepo } from '@/server/repos/alerts';
import { requireRole } from '@/server/auth/guards';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const role = await requireRole(['supervisor']);
  if (role instanceof NextResponse) return role;
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } }, { status: 400 });
  await alertsRepo(db).acknowledge(id);
  return new NextResponse(null, { status: 200 });
}
