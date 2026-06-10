# CLAUDE.md — Emberfall

Persistent online RPG. Phaser 3 client, Colyseus server, shared TypeScript types, Postgres persistence. Solo developer + Claude Code. Read `docs/PROGRESS.md` for current phase before doing anything.

## Documents (read on demand, not all at once)
- `docs/GDD.md` — game design. Consult before designing any gameplay system.
- `docs/ROADMAP.md` — phase order and exit criteria. NEVER build features from a later phase.
- `docs/ARCHITECTURE.md` — technical rules. Consult before any netcode, schema, or DB work.
- `docs/PROGRESS.md` — current phase, recent decisions, known bugs. Update at end of every session.

## Non-negotiable rules
1. **Server-authoritative everything.** The client sends intents (`move_to`, `use_ability`, `interact`). The server validates, simulates, and broadcasts state. NEVER trust client-supplied positions, damage, timers, inventory contents, or prices.
2. **Validate every inbound message** with zod schemas from `/shared`. Reject and log anything malformed. Rate-limit per message type.
3. **Shared types live in `/shared` only.** Client and server import from it. Never duplicate a type or magic number on both sides.
4. **Game content is data, not code.** Items, mobs, drop tables, quests, dialogue, recipes go in `/content/*.json`, validated by zod schemas, loaded at server boot. Adding a sword must never require editing combat code.
5. **Simulation logic is pure functions** in `server/src/sim/` — deterministic, no I/O, seeded RNG passed in. Every sim function gets Vitest unit tests. Netcode wires sim to rooms; it does not contain game math.
6. **Every item created or destroyed writes to the economy ledger** (`item_ledger` table). No exceptions. Dupes kill MMOs.
7. **One world tick = 600ms.** All game-logic timing is in ticks, not milliseconds. Movement is tile-based.
8. **Migrations only** for schema changes (Prisma). Never hand-edit the database in prod.
9. **No new runtime dependencies** without a one-line justification added to `docs/PROGRESS.md`.
10. **Small diffs.** One feature per session. If a task is growing, stop and split it.

## Commands (contract — keep these working)
- `pnpm dev` — run server + client concurrently (local)
- `pnpm test` — all Vitest suites
- `pnpm typecheck` — tsc across all workspaces
- `pnpm lint` — eslint
- `pnpm db:migrate` / `pnpm db:studio` — Prisma
- `pnpm bots -- --count 50` — headless load-test bots (exists from P2)

## Definition of Done (every feature)
- [ ] Typecheck + lint + tests pass
- [ ] Sim logic has unit tests; new content has schema validation
- [ ] Exploit pass done: "how would a hostile client abuse this?" — answer written in PR/commit message
- [ ] Playtested locally with 2 clients
- [ ] `docs/PROGRESS.md` updated (what shipped, decisions made, next up)
- [ ] Committed with a descriptive message

## Style
- TypeScript strict mode everywhere. No `any` without a `// why:` comment.
- Prefer boring, readable code over clever code. This codebase must be maintainable for years.
- Constants in `/shared/src/constants.ts` (tick rate, map sizes, caps). No magic numbers.
