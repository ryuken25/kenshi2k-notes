import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { canWriteFolder } from '@/lib/access';

// POST: upload a new .md file (multipart form-data with field "file",
// optional "folderId"). super_admin and editor only — plain 'user' is
// view/download only. editor additionally needs write access to the
// target folder (or root, which is super_admin only).
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderId = formData.get('folderId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.endsWith('.md')) {
      return NextResponse.json(
        { error: 'Only .md files are allowed' },
        { status: 400 }
      );
    }

    const targetFolderId = folderId ? Number(folderId) : null;
    if (!(await canWriteFolder(targetFolderId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const content = await file.text();

    let folderPath = '';
    if (folderId) {
      const folderRes = await pool.query(
        'SELECT path FROM folders WHERE id = $1',
        [folderId]
      );
      folderPath = folderRes.rows[0]?.path ?? '';
    }

    const path = folderPath ? `${folderPath}/${file.name}` : file.name;

    const result = await pool.query(
      `INSERT INTO files (name, folder_id, content, path)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
       RETURNING id, name, path`,
      [file.name, folderId || null, content, path]
    );

    return NextResponse.json({ file: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('File upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
