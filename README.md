# kenshi2k personal notes

A self-hosted, Obsidian-style personal notes web app backed entirely by Neon
Postgres. Renders a local vault of Markdown files as a folder tree with
wikilinks, an interactive graph view, and inline editing — all served from a
single Next.js app.

## Features

- **Obsidian-style UI** — dark/light theme, folder tree sidebar, markdown viewer with syntax highlighting
- **Wikilinks** — `[[Note Name]]` renders as clickable in-app navigation
- **Graph View** — interactive D3 force-directed graph of note connections (drag, zoom, hover-to-highlight)
- **Daily Notes** — dedicated journal view for the `Daily/` folder
- **In-app editing** — edit and save notes directly from the browser
- **Custom JWT auth** — no public registration; only the seeded `super_admin` can create accounts
- **Folder-level access control** — admin grants specific users access to specific folders (and their subfolders)
- **Vault sync script** — one-way sync from a local Obsidian vault into Neon

## Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript + Tailwind CSS v4
- Neon Postgres (`pg` driver)
- JWT auth via `jsonwebtoken` + `bcryptjs`
- D3.js (graph view, loaded via CDN)
- `react-markdown` + `remark-gfm` + `rehype-highlight`

## Setup

1. Clone and install:
   ```bash
   git clone https://github.com/Ryuken25/kenshi2k-notes.git
   cd kenshi2k-notes
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in:
   ```bash
   cp .env.example .env.local
   ```
   - `DATABASE_URL` — your Neon Postgres connection string
   - `JWT_SECRET` — a random secret (generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
   - `OBSIDIAN_VAULT_PATH` — absolute path to your local Obsidian vault (only needed for the sync script)

3. Run the schema against your Neon database (creates `users`, `folders`, `files`, `folder_permissions` and seeds the `super_admin` user):
   ```bash
   psql "$DATABASE_URL" -f schema.sql
   ```
   Then update the seeded password hash — the default schema ships a placeholder. Generate a real bcrypt hash:
   ```bash
   node -e "require('bcryptjs').hash('yourpassword', 10).then(console.log)"
   ```
   and `UPDATE users SET password = '<hash>' WHERE username = 'kenshi2k';`

4. Sync your local vault into the database:
   ```bash
   node scripts/sync-vault.js
   ```

5. Run the dev server:
   ```bash
   npm run dev
   ```

## Access control model

- `super_admin` sees and edits everything.
- `user` accounts see nothing by default. An admin grants access to specific
  folders from `/admin`; access cascades to subfolders automatically.
- Permission checks are enforced both when building the sidebar tree and on
  direct file API access (`GET`/`PUT`/`DELETE /api/files/[id]`), so a user
  can't bypass the UI by guessing file IDs.

## Security notes

- No public registration route exists. Only the seeded `super_admin` can add users.
- Session is a JWT stored in an httpOnly cookie (`sameSite=lax`, 1 year `maxAge`), cleared explicitly on logout.
- `route.ts`/`proxy.ts` enforce auth and role checks at the edge before hitting any API logic.
- Never commit `.env.local` — it's already in `.gitignore`.

## Deployment (Vercel)

```bash
vercel --prod
```

Set `DATABASE_URL` and `JWT_SECRET` as Vercel project environment variables
(Project Settings → Environment Variables). `OBSIDIAN_VAULT_PATH` is only
needed locally for the sync script, not in production.

## License

MIT
