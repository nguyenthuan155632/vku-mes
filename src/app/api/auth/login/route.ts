import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildSessionCookie, clearedCookie } from '@/server/auth/session';
import type { Role } from '@/lib/types';

const Body = z.object({ password: z.string().min(1) });

function roleFor(password: string): Role | null {
  if (password === process.env.SUPERVISOR_PASSWORD) return 'supervisor';
  if (password === process.env.OPERATOR_PASSWORD) return 'operator';
  if (password === process.env.VIEWER_PASSWORD) return 'viewer';
  return null;
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Thiếu mật khẩu' } }, { status: 400 });
  const role = roleFor(parsed.data.password);
  if (!role) {
    const res = NextResponse.json({ error: { code: 'BAD_CREDENTIALS', message: 'Mật khẩu không đúng' } }, { status: 401 });
    const c = clearedCookie();
    res.cookies.set(c.name, c.value, c.options as Parameters<typeof res.cookies.set>[2]);
    return res;
  }
  const res = NextResponse.json({ role });
  const cookie = await buildSessionCookie(role);
  res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2]);
  return res;
}
