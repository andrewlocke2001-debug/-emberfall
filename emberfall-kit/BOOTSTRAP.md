# BOOTSTRAP — Session 1

Why this file exists: instead of shipping pre-written scaffold code that rots as library versions move, this kit has Claude Code **generate the scaffold against current stable versions** and verify it runs before you write a single game feature. Paste the block below into Claude Code as your first message in the project folder.

---

## PASTE THIS INTO CLAUDE CODE (Session 1)

```
Read CLAUDE.md, docs/ARCHITECTURE.md, and Phase 0 of docs/ROADMAP.md in full before writing anything. Then enter plan mode and show me your plan before implementing.

TASK: Scaffold the Emberfall monorepo and get Phase 0's exit criteria passing.

Requirements:
1. pnpm workspace monorepo: /client (Phaser 3 + Vite + TS), /server (Node + Colyseus + TS), /shared (types, constants, zod schemas), /content (JSON game data + schemas). Check the CURRENT stable versions of colyseus, @colyseus/schema, colyseus.js, phaser, vite, zod, vitest, and prisma on npm and use those — do not rely on memorized versions. If a current API differs from what docs/ARCHITECTURE.md assumes, adapt the code and record the deviation in docs/PROGRESS.md.
2. Server: one Colyseus room "world:meadowbrook" implementing the authority model in docs/ARCHITECTURE.md — clients send move_to intents with tile coords, server validates against a hardcoded 40x40 walkable grid, simulates movement at the 600ms tick (1 tile/tick walking), broadcasts state via Colyseus schema.
3. Client: Phaser scene rendering a placeholder tile grid, the local player, and all remote players as colored rectangles with name labels. Click/tap a tile to send move_to. Tween sprites between tiles so movement looks smooth despite the 600ms tick. Must work on a phone browser (touch input, responsive canvas).
4. Shared: MessageType enum, zod schemas for every message, constants (TICK_MS=600, etc).
5. Persistence: Postgres via Prisma (assume DATABASE_URL in .env; include docker-compose.yml for a local Postgres). Player table: id, name, zone, x, y, created_at, last_seen. Save position on disconnect + every 30s. On reconnect, restore position.
6. Identity for now: client supplies a display name, server issues a signed session token (jose) tied to a player row. Real auth hardening is Phase 1 — but structure it so swapping in passwords later is clean.
7. Wire the command contract from CLAUDE.md: pnpm dev / test / typecheck / lint / db:migrate / db:studio. Add Vitest with at least: movement validation tests (rejects non-adjacent teleports, rejects walking into blocked tiles) and message schema tests.
8. GitHub Actions workflow: typecheck + test on push.
9. .gitignore, .env.example, root README with run instructions.

Exit criteria (verify each before declaring done):
- pnpm install && pnpm dev boots clean
- Two browser tabs each control a player; both see each other move in real time
- Sending a forged move_to (non-adjacent tile) via console is rejected server-side and logged
- Kill and restart the server: players reconnect and stand where they were
- pnpm test and pnpm typecheck pass
- git initialized, everything committed

When done, update docs/PROGRESS.md (mark Phase 0 items complete, log any decisions/deviations) and tell me exactly how to run the two-tab test myself.
```

---

## After Session 1

1. Run the two-tab test yourself. Don't take "it works" on faith — this habit matters for the next 12 phases.
2. **Deploy immediately** (Phase 0 includes it): next session, prompt Claude Code to deploy the server to Fly.io or Railway and the client to Cloudflare Pages or Netlify, with managed Postgres (Neon or Railway). The exit test becomes: you on your phone + one friend on theirs, walking around together over the real internet.
3. Then `/clear` and start working `docs/ROADMAP.md` Phase 1 using the session templates in `docs/WORKFLOW.md`.

## If Session 1 goes sideways

- Library API mismatch errors → tell Claude Code: "Check the installed version's actual docs/types and adapt; note the deviation in PROGRESS.md."
- Don't debug a broken scaffold for hours. It's cheaper to `git reset --hard`, refine the prompt with what you learned, and regenerate.
