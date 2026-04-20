import 'server-only';
import type { Role } from '@/lib/types';

const COOKIE_NAME = 'mes_session';
const TTL_MS = 12 * 3600_000;

export interface SessionPayload { role: Role; exp: number }

async function sign(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return Buffer.from(signature).toString('base64url');
}

export async function buildSessionCookie(role: Role): Promise<{ name: string; value: string; options: Record<string, unknown> }> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not set');
  const payload: SessionPayload = { role, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = await sign(body, secret);
  return {
    name: COOKIE_NAME,
    value: `${body}.${sig}`,
    options: { httpOnly: true, sameSite: 'lax', path: '/', maxAge: TTL_MS / 1000 }
  };
}

export async function readSession(cookieValue: string | undefined): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const [body, sig] = cookieValue.split('.');
  if (!body || !sig) return null;
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  let sigBuffer: Buffer;
  try {
    sigBuffer = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  
  try {
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      new Uint8Array(sigBuffer),
      enc.encode(body)
    );
    if (!isValid) return null;
  } catch {
    return null;
  }
  
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearedCookie() {
  return { name: COOKIE_NAME, value: '', options: { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 } };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
