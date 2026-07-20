import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/session';

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: TreeNode[];
}

interface FolderRow {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
}

/**
 * Expands a set of granted folder IDs to include all their descendants,
 * so granting access to a parent folder implicitly grants its subfolders.
 */
function expandWithDescendants(
  grantedIds: Set<number>,
  allFolders: FolderRow[]
): Set<number> {
  const byParent = new Map<number, FolderRow[]>();
  for (const f of allFolders) {
    if (f.parent_id !== null) {
      const list = byParent.get(f.parent_id) ?? [];
      list.push(f);
      byParent.set(f.parent_id, list);
    }
  }

  const result = new Set(grantedIds);
  const queue = [...grantedIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    const children = byParent.get(id) ?? [];
    for (const child of children) {
      if (!result.has(child.id)) {
        result.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return result;
}

/**
 * Returns the folder/file tree from Neon. super_admin sees everything.
 * Regular users only see folders explicitly granted via folder_permissions
 * (plus their subfolders) and files within those folders.
 */
export async function GET() {
  try {
    const session = await getSession();
    const isSuperAdmin = session?.role === 'super_admin';

    const foldersRes = await pool.query<FolderRow>(
      'SELECT id, name, parent_id, path FROM folders ORDER BY path'
    );
    const filesRes = await pool.query(
      'SELECT id, name, folder_id, path FROM files ORDER BY name'
    );

    let allowedFolderIds: Set<number> | null = null; // null = no restriction

    if (!isSuperAdmin && session) {
      const permRes = await pool.query(
        'SELECT folder_id FROM folder_permissions WHERE user_id = $1',
        [session.id]
      );
      const grantedIds = new Set<number>(permRes.rows.map((r) => r.folder_id));
      allowedFolderIds = expandWithDescendants(grantedIds, foldersRes.rows);
    }

    const folderMap = new Map<number, TreeNode>();
    for (const f of foldersRes.rows) {
      if (allowedFolderIds && !allowedFolderIds.has(f.id)) continue;
      folderMap.set(f.id, {
        id: `folder-${f.id}`,
        name: f.name,
        type: 'folder',
        path: f.path,
        children: [],
      });
    }

    const roots: TreeNode[] = [];

    for (const f of foldersRes.rows) {
      if (!folderMap.has(f.id)) continue;
      const node = folderMap.get(f.id)!;
      if (f.parent_id && folderMap.has(f.parent_id)) {
        folderMap.get(f.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    for (const file of filesRes.rows) {
      // Root-level files (no folder) are only visible to super_admin,
      // since there's no folder to scope permission on.
      if (!file.folder_id && !isSuperAdmin) continue;
      if (file.folder_id && allowedFolderIds && !allowedFolderIds.has(file.folder_id)) {
        continue;
      }

      const node: TreeNode = {
        id: `file-${file.id}`,
        name: file.name,
        type: 'file',
        path: file.path,
      };
      if (file.folder_id && folderMap.has(file.folder_id)) {
        folderMap.get(file.folder_id)!.children!.push(node);
      } else if (!file.folder_id) {
        roots.push(node);
      }
    }

    return NextResponse.json({ tree: roots });
  } catch (err) {
    console.error('Tree fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
