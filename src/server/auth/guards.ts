import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSession, SESSION_COOKIE_NAME } from './session';
import type { Role } from '@/lib/types';

export async function currentRole(): Promise<Role | null> {
  const raw = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = await readSession(raw);
  return session?.role ?? null;
}

export async function requireRole(allowed: Role[]): Promise<Role | NextResponse> {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' } }, { status: 401 });
  if (!allowed.includes(role)) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Không đủ quyền' } }, { status: 403 });
  return role;
}

export function requirePulseToken(req: Request): true | NextResponse {
  const hdr = req.headers.get('authorization') ?? '';
  const token = hdr.replace(/^Bearer\s+/i, '');
  const expected = process.env.PULSE_INGEST_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid ingest token' } }, { status: 401 });
  }
  return true;
}
