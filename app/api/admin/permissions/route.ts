import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: list all folder permissions, optionally filtered by userId.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    const query = userId
      ? `SELECT fp.id, fp.user_id, fp.folder_id, f.name, f.path
         FROM folder_permissions fp
         JOIN folders f ON f.id = fp.folder_id
         WHERE fp.user_id = $1
         ORDER BY f.path`
      : `SELECT fp.id, fp.user_id, fp.folder_id, f.name, f.path
         FROM folder_permissions fp
         JOIN folders f ON f.id = fp.folder_id
         ORDER BY fp.user_id, f.path`;

    const result = userId
      ? await pool.query(query, [userId])
      : await pool.query(query);

    return NextResponse.json({ permissions: result.rows });
  } catch (err) {
    console.error('Permissions fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: grant a user access to a folder (super_admin only, enforced in proxy.ts).
export async function POST(request: NextRequest) {
  try {
    const { userId, folderId } = await request.json();

    if (!userId || !folderId) {
      return NextResponse.json(
        { error: 'userId and folderId are required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO folder_permissions (user_id, folder_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, folder_id) DO NOTHING
       RETURNING id, user_id, folder_id`,
      [userId, folderId]
    );

    return NextResponse.json({ permission: result.rows[0] ?? null }, { status: 201 });
  } catch (err) {
    console.error('Permission grant error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: revoke access. Expects ?userId=&folderId= query params.
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const folderId = request.nextUrl.searchParams.get('folderId');

    if (!userId || !folderId) {
      return NextResponse.json(
        { error: 'userId and folderId query params are required' },
        { status: 400 }
      );
    }

    await pool.query(
      'DELETE FROM folder_permissions WHERE user_id = $1 AND folder_id = $2',
      [userId, folderId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Permission revoke error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
