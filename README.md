# EMBERFALL (working title)

An ambitious, combat-first persistent online RPG built on a **2D-web stack** —
a Phaser client and an authoritative Colyseus/TypeScript server — with
"massive" scale as the long-term north star. The systems (combat, netcode,
persistence, data) are the real game; the 2D renderer is a deliberate v1
choice that a future 3D client could replace without touching the server.

**Design docs live in [`design/`](design/)** — `GDD.md` (what the game is),
`ROADMAP.md` (phases P0–P12 + exit criteria), `PROGRESS.md` (current status —
read this first), `DEPLOY.md` (hosting runbook). Engineering rules Claude Code
follows every session: [`CLAUDE.md`](CLAUDE.md).

Current state: **P0** — two players in one zone, server-authoritative
movement, tab-target combat against a training dummy, characters persisted in
a real database. Remaining for P0 exit: deploy (see `design/DEPLOY.md`).

## Architecture

npm-workspaces monorepo:

| Package | What it is |
|---|---|
| `shared/` | Pure, engine-agnostic game rules — types, tuning constants, the Colyseus schema, the wire protocol, and **pure systems** (`combat`, `movement`) with co-located Vitest tests. The server runs these authoritatively; the client reuses them for prediction. |
| `server/` | Colyseus 0.17 authoritative server. `ZoneRoom` owns the synced `ZoneState`, runs a fixed 20 Hz simulation loop, validates client intent, and resolves combat via `shared`'s pure functions. **Prisma persistence** — SQLite locally (zero setup), Postgres in production. |
| `client/` | Phaser 3 + Vite. Renders authoritative state, predicts the local player's movement, interpolates remote entities, and sends intent (move / use-ability). Imports the schema **as types only** so Colyseus decorators never reach the browser bundle. |

Key decisions (locked — see `design/GDD.md`): **real-time 20 Hz** (not OSRS
ticks) · **server-authoritative** (clients send intent, never trusted state) ·
**tab-target combat** (latency-tolerant, crowd-scalable) · **rooms = zones**
(the unit we later shard toward "massive") · schema via `defineTypes()` rather
than `@type` decorators (tsx/esbuild does not reliably apply
`experimentalDecorators`).

## Run it

```bash
cd mmo
npm install                        # first time only (also generates the Prisma client)
npm run db:migrate -w @mmo/server  # first time only (creates the local SQLite DB)
npm run dev                        # server (:2567) + client (:5173) together
```

Open http://localhost:5173, enter a name, and you're in. Open a second tab (or
send a friend the URL on your LAN) to see another player. Append `?canvas=1`
to force Phaser's Canvas renderer (used for headless screenshots).

- Move: **WASD / arrows**
- Target: **click** an entity (**Esc** to clear)
- Attack: hold **Space**

## Verify

```bash
npm run typecheck                 # all three workspaces
npm test                          # shared unit tests (combat + movement)
npm run test:e2e -w @mmo/client   # two-player + persistence end-to-end (Playwright)
```

The e2e suite proves the hard parts: two browser contexts share one room and
both observe the same authoritative combat, and a character survives a reload
(round-tripped through the database).

## Database

```bash
npm run db:migrate -w @mmo/server   # create/apply migrations (dev)
npm run db:studio  -w @mmo/server   # browse the data
```

Local dev uses SQLite at `server/prisma/dev.db`. Production uses Postgres
(Neon) — the swap procedure is in `design/DEPLOY.md`.
