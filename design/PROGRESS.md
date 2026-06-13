# EMBERFALL — Progress Log

Living log. Update at the end of every session: what shipped, decisions made,
next up. This file is how any session (or month-long absence) knows exactly
where the project stands.

## Current phase

**P0 — Foundation (exit test pending).** Server is LIVE on the internet:
- GitHub: https://github.com/andrewlocke2001-debug/-emberfall (CI on push)
- DB: Neon Postgres (us-west-2), migrated, e2e-verified
- Server: https://emberfall-server.fly.dev — Colyseus 0.17.43 responding,
  region gru, **scaled to exactly 1 machine** (two in-memory worlds = players
  can't see each other; re-check after every `fly scale`/deploy until P11's
  Redis driver)
- Client: Netlify — user connecting the repo (netlify.toml is committed)

## Next up (in order)

1. User finishes Netlify import → site URL → **P0 exit test:** two phones,
   real internet, walk + fight + reconnect. Record result here; P0 CLOSED.
2. Then P1: Tiled maps (Meadowbrook/Greenreach), auth, zod validation, chat

## Shipped

### 2026-06-13 — Cold-start resilience (the real "stuck on Entering" fix) ✅
- Diagnosed via logs: a real player joined fine while the machine was awake,
  then Fly stopped the machine (SIGTERM) despite deployed `auto_stop_machines:
  false`. A websocket join against a stopped machine hangs forever → the
  "stuck on Entering Verdant Vale" the user saw. (So it was infra lifecycle,
  not a code bug — the game itself always worked when the server was up.)
- Two-layer fix: (1) client `connectToZone` wakes the server via HTTP polling
  before joining (the request triggers Fly auto_start), shows progress + a 75s
  budget, BootScene offers tap/key retry; (2) `.github/workflows/keepwarm.yml`
  pings the server every 5 min so it stays awake.
- Verified post-deploy: 1 machine started, live SDK join OK, new bundle
  `index-KribFUb2.js` served. Bundle resilience confirmed shipped.

### 2026-06-12 — One-URL deploy + production crash-loop fix ✅
- **The Fly app now serves the game itself** (express static of client/dist,
  built in-image; client resolves endpoint same-origin). Netlify dependency
  dropped — netlify.toml stays as an optional future path. ONE URL:
  https://emberfall-server.fly.dev
- **Root-caused the production hang** ("stuck on Entering…"): Neon serverless
  kills idle Postgres sockets → pg pool emitted unhandled 'error' → Node
  died → Fly machine stopped → next visitor hit a ~15s cold boot with hanging
  joins. Fixed three ways: own pg.Pool (idleTimeoutMillis 30s + error
  handler), 4-min SELECT 1 heartbeat (also prevents Neon free-tier compute
  suspend), process-level uncaught/unhandled guards, and fly.toml
  `[[restart]] policy="always"`.
- Live verification over the real internet: matchmake 200 ✓, raw WS upgrade +
  join handshake ✓ (tools/live-ws-probe.mjs), full Node SDK join ✓
  (tools/live-join.mjs). NOTE: the local sandboxed Chromium cannot execute
  external-HTTPS page scripts (bodies stall) — browser-level live checks must
  run on a real device; identical bundle verified end-to-end via LAN origin
  (tools/live-smoke.mjs against http://<lan-ip>:2567).
- Docker gotchas fixed: tsconfig.base.json must be COPYd (extends chain);
  image builds client with vite only (tsc stays the local/CI gate).
- New deps: express (static hosting), pg + @types/pg (owned pool).

### 2026-06-10 — P0 production plumbing ✅
- **Prisma 7 persistence** replaces the JSON snapshot store: `Player` table,
  SQLite locally (`server/prisma/dev.db`, no Docker needed), driver-adapter
  setup (`@prisma/adapter-better-sqlite3`), `db:migrate`/`db:studio`/
  `db:deploy`/`db:generate` scripts, root `postinstall` generates the client.
  Async store with fault-tolerant snapshot writes. All tests green against
  the DB (14 unit + 2 e2e incl. reconnect persistence).
- **git repo initialized**, initial commit; `.gitignore` covers env/db/
  generated client.
- **CI:** `.github/workflows/ci.yml` — typecheck + unit tests on push.
- **Deploy prep:** `server/Dockerfile` (workspace-aware, migrate-on-boot),
  `fly.toml`, `.dockerignore`, `server/.env.example`, runbook at
  `design/DEPLOY.md`. Client already reads `VITE_SERVER_URL`.
- New runtime deps (rule 9): `@prisma/client` + `@prisma/adapter-better-sqlite3`
  (persistence), `tsx` moved to deps (prod runtime executes TS directly).
  Dev deps: `prisma`, `dotenv` (prisma.config.ts env loading).

### 2026-06-09 — M0/P0 local slice ✅
- npm-workspaces monorepo (`shared`/`server`/`client`), strict TS everywhere
- Colyseus 0.17 zone room: 20 Hz authoritative sim, movement intents
  validated/clamped server-side, tab-target ability vs training dummy
- Phaser 3 client: prediction + reconciliation (local), interpolation
  (remote), nameplates, health bars, click-to-target, R to attack
- Reconnect restores character (JSON snapshot store, keyed by playerId)
- 14 Vitest unit tests (combat/movement) + 2 Playwright e2e (two-player sync,
  persistence); typecheck clean across all workspaces

### 2026-06-10 — Design reconciliation ✅
- Emberfall starter kit (7/9 docs recovered) merged into `design/`:
  GDD, ROADMAP (P0–P12 + exit criteria), INSPIRATION_MAP, WORKFLOW, this log,
  and repo `CLAUDE.md`. Kit's BOOTSTRAP is obsolete (scaffold exists);
  kit's ARCHITECTURE.md was not recovered and is superseded by the working
  repo + CLAUDE.md rules.

## Decision log

- **2026-06-11 — Postgres EVERYWHERE (Neon), SQLite dropped.** Deviation from
  DEPLOY.md §2's "SQLite locally / PG in prod": Prisma 7 driver adapters
  declare a provider that must match the schema provider, so one schema can't
  serve both engines. Local dev + prod now share the same Neon DB (split into
  a Neon branch for dev when it starts to matter). Local dev requires
  internet — acceptable for an online game. `@prisma/adapter-better-sqlite3`
  removed; `@prisma/adapter-pg` added; `dotenv` promoted to runtime dep
  (db.ts loads server/.env).

- **2026-06-10 — REAL-TIME 20 Hz LOCKED** over the kit's 600ms OSRS tick.
  Criteria: most popular modern combat model, least clunky, netcode already
  built and verified; deliberate pacing via ~1.5s GCD (FFXIV), not input
  quantization. Do not reopen.
- **2026-06-10** — Classless skills (8 launch skills, RS-style) supersede the
  M0 `ClassId` placeholder; refactor lands with P2 combat core.
- **2026-06-09** — Colyseus schema via `defineTypes()` + `declare` fields
  (NOT `@type` decorators — tsx/esbuild emits TC39 decorators that crash
  Colyseus). See CLAUDE.md gotchas.
- **2026-06-09** — Phaser pinned to v3 (^3.90) for consistency with the
  user's other projects; npm resolves v4 by default — don't upgrade casually.
- **2026-06-09** — Persistence M0 = JSON snapshots (zero native deps on
  Windows); Prisma/Postgres is the P0-remainder upgrade.

## Known bugs / debt

- Zone is the placeholder `verdant-vale` open grid — replaced by Tiled
  Meadowbrook/Greenreach in P1 (rename `zoneId` then).
- No inbound-message schema validation yet beyond clamping — zod lands P1.
- Migrations are SQLite-flavored; the Postgres swap (provider + adapter-pg +
  regenerated init migration) happens at the deploy session — DEPLOY.md §2.
- Headless-Chromium WebGL doesn't paint into screenshots; `?canvas=1` query
  flag forces the Canvas renderer for visual capture (used by e2e).
