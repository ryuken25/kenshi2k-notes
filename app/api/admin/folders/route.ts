import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: flat list of all folders (for the admin permission picker).
export async function GET() {
  try {
    const result = await pool.query(
      'SELECT id, name, path FROM folders ORDER BY path'
    );
    return NextResponse.json({ folders: result.rows });
  } catch (err) {
    console.error('Folders fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
