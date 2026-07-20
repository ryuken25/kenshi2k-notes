import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/session';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Checks whether the current session is allowed to access a file's folder.
 * super_admin always passes. Regular users need a folder_permissions row
 * for the file's folder or any of its ancestor folders.
 */
async function canAccessFile(fileFolderId: number | null): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (session.role === 'super_admin') return true;
  if (fileFolderId === null) return false; // root-level files are admin-only

  // Walk up the folder ancestry checking for a granted permission.
  return walkFolderAncestry(session.id, fileFolderId);
}

async function getParentFolderId(folderId: number): Promise<number | null> {
  const res = await pool.query('SELECT parent_id FROM folders WHERE id = $1', [
    folderId,
  ]);
  const row = res.rows[0] as { parent_id: number | null } | undefined;
  return row ? row.parent_id : null;
}

async function walkFolderAncestry(
  userId: number,
  startFolderId: number,
  depth = 0
): Promise<boolean> {
  if (depth > 50) return false; // guard against cycles

  const permRes = await pool.query(
    'SELECT 1 FROM folder_permissions WHERE user_id = $1 AND folder_id = $2',
    [userId, startFolderId]
  );
  if (permRes.rows.length > 0) return true;

  const parentId = await getParentFolderId(startFolderId);
  if (parentId === null) return false;
  return walkFolderAncestry(userId, parentId, depth + 1);
}

// GET: fetch a single file's content (for viewer + download).
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const result = await pool.query(
      'SELECT id, name, path, content, folder_id FROM files WHERE id = $1',
      [id]
    );

    const file = result.rows[0];
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (!(await canAccessFile(file.folder_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const download = request.nextUrl.searchParams.get('download');
    if (download) {
      return new NextResponse(file.content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${file.name}"`,
        },
      });
    }

    return NextResponse.json({ file });
  } catch (err) {
    console.error('File fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: update a file's content (in-app editing).
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const fileRes = await pool.query(
      'SELECT folder_id FROM files WHERE id = $1',
      [id]
    );
    const existing = fileRes.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    if (!(await canAccessFile(existing.folder_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { content } = await request.json();
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE files SET content = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, path, content`,
      [content, id]
    );

    return NextResponse.json({ file: result.rows[0] });
  } catch (err) {
    console.error('File update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: remove a file (used by admin/user file management).
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const fileRes = await pool.query(
      'SELECT folder_id FROM files WHERE id = $1',
      [id]
    );
    const existing = fileRes.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    if (!(await canAccessFile(existing.folder_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await pool.query('DELETE FROM files WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('File delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
