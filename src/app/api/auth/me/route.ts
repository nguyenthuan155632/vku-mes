import { NextResponse } from 'next/server';
import { currentRole } from '@/server/auth/guards';
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: '' } }, { status: 401 });
  return NextResponse.json({ role });
}
