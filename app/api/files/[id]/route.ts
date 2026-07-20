import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { canViewFolder, canWriteFolder } from '@/lib/access';

type RouteParams = { params: Promise<{ id: string }> };

// GET: fetch a single file's content (for viewer + download).
// All roles (user/editor/super_admin) can view/download within granted folders.
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

    if (!(await canViewFolder(file.folder_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const download = request.nextUrl.searchParams.get('download');
    if (download) {
      // Force a real file download (not inline markdown preview).
      // Sanitize filename for Content-Disposition header safety.
      const rawName = String(file.name || 'note.md');
      let safeName =
        rawName
          .replace(/[\r\n"]/g, '')
          .replace(/[\\/:*?<>|]+/g, '-')
          .trim() || 'note.md';
      // Always give browsers a file extension so they don't treat it as
      // a navigable markdown document.
      if (!/\.[A-Za-z0-9]{1,8}$/.test(safeName)) {
        safeName = `${safeName}.md`;
      }
      const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_') || 'note.md';
      const utf8Name = encodeURIComponent(safeName);
      const body = typeof file.content === 'string' ? file.content : '';
      const bytes = new TextEncoder().encode(body);

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          // octet-stream beats text/markdown for "Save As" behavior across
          // desktop + mobile + in-app browsers (Telegram/Safari/Chrome).
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(bytes.byteLength),
          'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
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
// Only super_admin and editor can write; plain 'user' is read-only.
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
    if (!(await canWriteFolder(existing.folder_id))) {
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

// DELETE: remove a file. Only super_admin and editor can delete.
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
    if (!(await canWriteFolder(existing.folder_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await pool.query('DELETE FROM files WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('File delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
