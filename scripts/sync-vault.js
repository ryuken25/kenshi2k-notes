#!/usr/bin/env node
/**
 * Syncs a local Obsidian vault into the Neon Postgres database used by
 * this app. Walks the vault directory, mirrors folders 1:1 into the
 * `folders` table, and upserts every .md file's raw content into `files`.
 *
 * Usage:
 *   DATABASE_URL=... OBSIDIAN_VAULT_PATH=... node scripts/sync-vault.js
 *
 * Or rely on a .env file being loaded by your shell/dotenv setup.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const VAULT = process.env.OBSIDIAN_VAULT_PATH;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
if (!VAULT || !fs.existsSync(VAULT)) {
  console.error(`OBSIDIAN_VAULT_PATH is not set or does not exist: ${VAULT}`);
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip .obsidian, .trash, etc.
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push({ type: 'folder', full, rel: path.relative(VAULT, full) });
      walk(full, results);
    } else if (entry.name.endsWith('.md')) {
      results.push({ type: 'file', full, rel: path.relative(VAULT, full), name: entry.name });
    }
  }
  return results;
}

async function main() {
  const entries = walk(VAULT);
  const folders = entries.filter((e) => e.type === 'folder');
  const files = entries.filter((e) => e.type === 'file');

  console.log(`Found ${folders.length} folders, ${files.length} files`);

  const folderIdMap = new Map(); // rel path -> db id

  for (const f of folders) {
    const parentPath = path.dirname(f.rel);
    const parentId = parentPath === '.' ? null : folderIdMap.get(parentPath) || null;
    const name = path.basename(f.rel);

    const res = await pool.query(
      `INSERT INTO folders (name, parent_id, path)
       VALUES ($1, $2, $3)
       ON CONFLICT (path) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id`,
      [name, parentId, f.rel]
    );
    folderIdMap.set(f.rel, res.rows[0].id);
  }
  console.log(`✅ ${folders.length} folders synced`);

  let count = 0;
  for (const f of files) {
    const content = fs.readFileSync(f.full, 'utf8');
    const folderPath = path.dirname(f.rel);
    const folderId = folderPath === '.' ? null : folderIdMap.get(folderPath) || null;

    await pool.query(
      `INSERT INTO files (name, folder_id, content, path)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
       RETURNING id`,
      [f.name, folderId, content, f.rel]
    );
    count++;
  }
  console.log(`✅ ${count} files synced`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
