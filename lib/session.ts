import { cookies } from 'next/headers';
import { verifyToken, AUTH_COOKIE_NAME, type JwtPayload } from './auth';

/**
 * Reads the session cookie (Next.js 16: cookies() is async-only) and
 * returns the decoded JWT payload, or null if absent/invalid.
 */
export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<JwtPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireAdmin(): Promise<JwtPayload> {
  const session = await requireSession();
  if (session.role !== 'super_admin') {
    throw new Error('FORBIDDEN');
  }
  return session;
}
