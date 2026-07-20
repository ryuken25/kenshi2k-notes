import pool from './db';
import { getSession } from './session';
import type { JwtPayload } from './auth';

/**
 * Checks whether the current session can VIEW a file/folder.
 * super_admin always passes. editor/user need a folder_permissions row
 * for the folder or any of its ancestor folders. Root-level files
 * (no folder) are super_admin only.
 */
export async function canViewFolder(folderId: number | null): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (session.role === 'super_admin') return true;
  if (folderId === null) return false;
  return walkFolderAncestry(session.id, folderId);
}

/**
 * Checks whether the current session can EDIT/UPLOAD/DELETE within a folder.
 * super_admin always passes. editor needs the same folder access as
 * viewing (folder_permissions). Plain 'user' role can never write.
 */
export async function canWriteFolder(folderId: number | null): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (session.role === 'super_admin') return true;
  if (session.role !== 'editor') return false;
  if (folderId === null) return false;
  return walkFolderAncestry(session.id, folderId);
}

export async function getCurrentSession(): Promise<JwtPayload | null> {
  return getSession();
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
