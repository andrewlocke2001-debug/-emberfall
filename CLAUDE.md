# CLAUDE.md — Emberfall (working title)

Persistent online RPG. Phaser 3 client, Colyseus 0.17 server, shared
TypeScript systems, npm workspaces. Solo developer + Claude Code. Read
`design/PROGRESS.md` for the current phase before doing anything.

## Documents (read on demand, not all at once)

- `design/GDD.md` — game design + LOCKED architecture decisions. Consult
  before designing any gameplay system.
- `design/ROADMAP.md` — phase order (P0–P12) and exit criteria. NEVER build
  features from a later phase than the current one in PROGRESS.md.
- `design/INSPIRATION_MAP.md` — which feature comes from which game, and when.
- `design/PROGRESS.md` — current phase, decisions, known bugs. Update at end
  of every session.
- `design/WORKFLOW.md` — the human's operating manual (session ritual).

## Non-negotiable rules

1. **Server-authoritative everything.** The client sends intents (`move`,
   `useAbility`, `interact`). The server validates, simulates, broadcasts.
   NEVER trust client-supplied positions, damage, timers, inventory, prices.
2. **Validate every inbound message** (zod schemas in `@mmo/shared` from P1;
   until then, explicit guards). Reject and log malformed input. Rate-limit
   per message type.
3. **Shared types live in `@mmo/shared` only.** Never duplicate a type or
   magic number on both sides. Constants in `shared/src/types/index.ts`.
4. **Game content is data, not code.** Items, mobs, drops, quests, dialogue
   are typed data modules in `shared/src/data/` (compile-checked references —
   our stronger version of the kit's JSON). Adding a sword must never require
   editing combat code.
5. **Simulation logic is pure functions** in `shared/src/systems/` —
   deterministic, no I/O, seeded RNG passed in. Every sim function gets
   Vitest unit tests (co-located `*.test.ts`). Rooms wire sim to netcode;
   they do not contain game math. (Shared placement — not server-only — so
   client prediction reuses the exact same functions.)
6. **Every item created or destroyed writes to the economy ledger** (from P3).
   No exceptions. Dupes kill MMOs.
7. **Real-time 20 Hz simulation — LOCKED 2026-06-10.** All game timing is
   milliseconds in shared constants (GCD ~1500ms, weapon speeds, telegraphs).
   Continuous coordinates; Tiled supplies collision. Do NOT reintroduce the
   600ms tile tick; do not reopen this decision without explicit user request.
8. **Migrations only** for DB schema changes (Prisma, once P0-remainder
   lands). Never hand-edit the database in prod.
9. **No new runtime dependencies** without a one-line justification added to
   `design/PROGRESS.md`.
10. **Small diffs.** One feature per session. If a task is growing, stop and
    split it.

## Colyseus 0.17 gotchas (verified against installed types — docs lie)

- Schema MUST use `defineTypes()` + `declare` fields + constructor init —
  NOT `@type` decorators (tsx/esbuild emits TC39 decorators, which crash
  Colyseus's legacy decorator). See `shared/src/schema/state.ts`.
- Client pkg is `@colyseus/sdk`; state callbacks via `getStateCallbacks(room)`.
- Keep schema classes OUT of the shared barrel; client imports them as
  `import type` only.
- When using any Colyseus API for the first time, check the installed
  `.d.ts` in `node_modules/@colyseus/*` — not memory, not web docs.

## Commands (contract — keep these working)

- `npm run dev` — server (:2567) + client (:5173) concurrently
- `npm test` — Vitest suites (shared systems)
- `npm run typecheck` — tsc across all three workspaces
- `npm run test:e2e` — Playwright two-client suite (client workspace)
- `npm run db:migrate` / `npm run db:studio` — Prisma (after P0-remainder)
- `npm run bots -- --count 50` — headless load bots (exists from P2)

## Definition of Done (every feature)

- [ ] Typecheck + tests pass (`npm run typecheck && npm test`)
- [ ] Sim logic has unit tests; new content passes schema validation
- [ ] Exploit pass done: "how would a hostile client abuse this?" — answer
      written in the commit message
- [ ] Playtested locally with 2 clients
- [ ] `design/PROGRESS.md` updated (what shipped, decisions, next up)
- [ ] Committed with a descriptive message

## Style

- TypeScript strict mode everywhere (see `tsconfig.base.json`). No `any`
  without a `// why:` comment.
- Prefer boring, readable code over clever code. Maintainable for years.
- No magic numbers — shared constants only.
