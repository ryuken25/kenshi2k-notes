import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in environment variables');
}

export interface JwtPayload {
  id: number;
  username: string;
  role: 'super_admin' | 'user';
}

export function signToken(payload: JwtPayload): string {
  // No expiresIn — token persists until the user explicitly logs out,
  // matching the "persist until logout" cookie requirement.
  return jwt.sign(payload, JWT_SECRET);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const AUTH_COOKIE_NAME = 'kenshi2k_session';
