import { NextResponse, type NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE_NAME } from '@/server/auth/session';

const PUBLIC_PATHS = ['/login'];
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/logout', '/api/pulse'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = await readSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname.startsWith('/api')) {
    if (!session) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' } }, { status: 401 });
    return NextResponse.next();
  }

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (session.role === 'operator' && (pathname.startsWith('/supervisor') || pathname.startsWith('/admin'))) {
    const url = req.nextUrl.clone(); url.pathname = '/'; return NextResponse.redirect(url);
  }
  if (session.role === 'viewer' && pathname.startsWith('/admin')) {
    const url = req.nextUrl.clone(); url.pathname = '/supervisor'; return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
