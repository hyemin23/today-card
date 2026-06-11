import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stateless admin session (no DB yet).
 *
 * Login compares the submitted password to ADMIN_KEY, then sets an httpOnly
 * cookie holding an HMAC-derived session token (not the raw key). Every
 * protected request re-derives the token and compares — survives restarts,
 * needs no storage.
 *
 * Later: swap checkPassword() for a DB user lookup and sessionToken() for a
 * signed JWT / real session — the call sites (login, status, /api/image) stay
 * the same.
 */

export const ADMIN_COOKIE = 'ink_admin_session';
const SESSION_SALT = 'ink-admin-session-v1';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Token stored in the cookie — HMAC of a constant keyed by ADMIN_KEY. */
export function sessionToken(): string {
  const key = process.env.ADMIN_KEY || '';
  return createHmac('sha256', key).update(SESSION_SALT).digest('hex');
}

/** True when the submitted password matches ADMIN_KEY. */
export function checkPassword(password: string): boolean {
  const key = process.env.ADMIN_KEY || '';
  if (!key || !password) return false;
  return safeEqual(password, key);
}

/** True when a cookie token is a valid admin session. */
export function verifySession(token: string | undefined | null): boolean {
  if (!process.env.ADMIN_KEY || !token) return false;
  return safeEqual(token, sessionToken());
}
