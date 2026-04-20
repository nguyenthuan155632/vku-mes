import { NextResponse } from 'next/server';
import { clearedCookie } from '@/server/auth/session';
export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  const c = clearedCookie();
  res.cookies.set(c.name, c.value, c.options as Parameters<typeof res.cookies.set>[2]);
  return res;
}
