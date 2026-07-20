import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

// DELETE: remove a user (super_admin only). Prevent deleting the seed
// super_admin account to avoid locking everyone out of /admin.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    const user = userRes.rows[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.username === 'kenshi2k') {
      return NextResponse.json(
        { error: 'Cannot delete the primary super_admin account' },
        { status: 403 }
      );
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('User delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
