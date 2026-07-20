import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword } from '@/lib/auth';

// GET: list all users (super_admin only, enforced in proxy.ts).
export async function GET() {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY id'
    );
    return NextResponse.json({ users: result.rows });
  } catch (err) {
    console.error('Users fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: add a new user (super_admin only). No public self-registration.
export async function POST(request: NextRequest) {
  try {
    const { username, password, role } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const finalRole = role === 'super_admin' ? 'super_admin' : 'user';
    const hashed = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (username, password, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, created_at`,
      [username, hashed, finalRole]
    );

    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    ) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }
    console.error('User create error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
