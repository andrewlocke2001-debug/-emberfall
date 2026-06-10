# EMBERFALL — Deploy Runbook (P0 exit)

Goal: **you on your phone + a friend on theirs, over the real internet, see
each other walk.** Everything below is prepared in-repo (Dockerfile, fly.toml,
CI); the steps marked 👤 need your accounts and take ~20 minutes total.
Do this in a Claude Code session — it runs the commands, you do the signups.

## Stack

| Piece | Host | Free tier |
|---|---|---|
| Zone server (Colyseus, Docker) | Fly.io | ✅ (small VM) |
| Postgres | Neon | ✅ |
| Client (static Vite build) | Netlify or Cloudflare Pages | ✅ |
| CI | GitHub Actions | ✅ |

## 1 — GitHub remote (CI goes live)

👤 Create an empty GitHub repo (private is fine), then:

```powershell
cd mmo
git remote add origin https://github.com/<you>/emberfall.git
git push -u origin main
```

CI (typecheck + unit tests) runs on every push from then on.

## 2 — Postgres (Neon)

👤 Sign up at neon.tech → New Project ("emberfall") → copy the connection
string (`postgresql://...sslmode=require`).

Then in a build session, switch the server to Postgres:

1. `server/prisma/schema.prisma`: `provider = "sqlite"` → `"postgresql"`.
2. `npm install @prisma/adapter-pg -w @mmo/server` and update
   `server/src/persistence/db.ts` to pick the adapter by URL scheme:
   `postgres…` → `PrismaPg`, otherwise `PrismaBetterSqlite3` (keeps local
   SQLite dev working unchanged).
3. Regenerate migrations for Postgres: delete `server/prisma/migrations/`,
   set `DATABASE_URL` to the Neon string, run
   `npm run db:migrate -w @mmo/server -- --name init`.
4. Local dev keeps using SQLite via `server/.env`; Neon's URL lives only in
   Fly secrets (next step). NOTE: once on Postgres-flavored migrations, local
   `db:migrate` runs need a `DATABASE_URL` pointing at Postgres (use a second
   free Neon branch as your dev DB, or keep a `migrations-sqlite/` copy —
   decide at the deploy session).

## 3 — Server (Fly.io)

👤 Sign up at fly.io, install flyctl
(`pwsh -c "iwr https://fly.io/install.ps1 -useb | iex"`), `fly auth login`.

```powershell
cd mmo
fly launch --no-deploy --copy-config   # accept the existing fly.toml; pick app name + region
fly secrets set DATABASE_URL="<neon connection string>"
fly deploy
```

The Dockerfile runs `prisma migrate deploy` on boot, then starts the server.
Verify: `fly logs` shows `zone server listening`.

## 4 — Client (Netlify)

👤 Sign up at netlify.com (or Cloudflare Pages — equivalent).

Connect the GitHub repo with build settings:
- Base directory: `client` · Build command: `npm run build` (run from repo
  root with workspaces: use `cd .. && npm ci && npm run build`) · Publish
  directory: `client/dist`
- Environment variable: `VITE_SERVER_URL = wss://<your-fly-app>.fly.dev`

(The client already reads `VITE_SERVER_URL`; localhost is only the fallback.)

## 5 — The P0 exit test

1. Open the Netlify URL on your phone (cellular, not wifi).
2. Friend opens it on theirs.
3. Walk to each other. Attack the dummy. Both see it.
4. `fly apps restart` — reconnect; you're standing where you were.

Record the result in `design/PROGRESS.md` and P0 is CLOSED.

## Gotchas to expect (don't debug blind)

- **CORS / matchmaking:** the Colyseus SDK matchmakes over HTTP before the
  WebSocket upgrade. If the client can't join cross-origin, configure CORS on
  the server transport/router for the Netlify origin — check the installed
  `@colyseus/core` types for the 0.17 way (don't trust old docs).
- **WSS only:** the client must use `wss://` (not `ws://`) — Fly terminates
  TLS and Netlify pages are https; mixed content is blocked by browsers.
- **Free-tier sleep:** fly.toml pins `min_machines_running = 1` /
  `auto_stop_machines = "off"` — if the app still sleeps, check Fly's current
  free-tier policy.
