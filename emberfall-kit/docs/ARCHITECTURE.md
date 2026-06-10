# EMBERFALL — Architecture

Technical law for this project. If code contradicts this doc, the code is wrong or this doc gets amended (note it in `docs/PROGRESS.md`).

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript strict, everywhere | one language, shared types |
| Client | Phaser 3 + Vite | proven 2D, browser-first |
| Server | Node + Colyseus | room-based authoritative state sync |
| Sync | @colyseus/schema | delta-compressed state patches |
| DB | Postgres + Prisma | persistence, migrations |
| Cache/pubsub | Redis | global chat, presence, rate limits (enters ~P1, required by multi-process P11) |
| Validation | zod (in /shared) | every message, every content file |
| Tests | Vitest | sim + schema + integration bots |
| Maps | Tiled (.tmj) | zone authoring |
| Hosting | Fly.io/Railway (server), Neon/managed PG, Cloudflare Pages/Netlify (client) | cheap, scalable enough |

## Monorepo layout

```
/client        Phaser app (rendering, input, interpolation — ZERO game rules)
/server
  /src/rooms   Colyseus rooms (netcode wiring only)
  /src/sim     pure game logic: movement, combat math, xp, drops (unit-tested)
  /src/services persistence, auth, ledger, chat
/shared        types, MessageType enum, zod schemas, constants  ← single source of truth
/content       items.json, mobs/, drops/, quests/, dialogue/, abilities.json + zod schemas
/tools         bots (headless load clients), content validators, balance reports
```

## Authority model (the most important section)

**Client = renderer + intent sender. Server = the game.**

```
client                          server
  | -- move_to {x,y} ----------> validate (zod) → pathfind (A*) → queue
  | -- use_ability {id,target}-> validate → range/cooldown/energy check → queue
  |                              every 600ms TICK: resolve all queued actions,
  |                              advance movement 1 tile, run mob AI, apply damage
  | <==== schema state patches (positions, hp, anims) ====
  | <---- events: damage numbers, chat, loot, level-up ----
client tweens sprites between tile states (smooth at 600ms cadence)
```

- **No client prediction in v1.** Tile movement + tweening hides the tick latency (OSRS proves the feel works). Revisit only if playtests demand it.
- Every inbound message: zod-parse → reject+log on failure → per-type rate limit (e.g., move_to ≤ 5/s, chat ≤ 1/2s).
- Server-side checks that must exist for every action: range, line-of-sight (where relevant), cooldown in ticks, resource cost, state legality (can't attack while dead), ownership (can't drop items you don't have).

## Tick model

- `TICK_MS = 600` in `/shared/src/constants.ts`. ALL gameplay timing expressed in ticks.
- Each room runs its own tick loop. Tick budget target: <50ms per tick per room; log a metric every tick, alert if exceeded.
- RNG: seeded per room (seed logged) → deterministic replays for bug reports and sim tests.

## World topology: zones as rooms

- One Colyseus room per zone instance: `world:greenreach`, `world:greenreach:d2` (districts), `dungeon:cinder:<runId>`.
- Zone transfer = leave room A, server hands a signed transfer ticket, join room B at the linked exit tile.
- **Districts:** lobby service spawns `:d2` when occupancy > cap (~100); switcher UI in towns. Risk zones never district.
- Global systems (global chat, whispers, Exchange, guilds, presence) live OUTSIDE rooms: Redis pub/sub + Postgres. Rooms subscribe to what they need.

## Persistence

- **Write-behind:** gameplay mutates in-memory state; dirty players flushed to PG every 30s, on logout, and on zone transfer. Items, trades, Exchange orders, and ledger entries write **synchronously/transactionally** — economy state is never write-behind.
- Core tables: `player`, `player_skill`, `item_instance`, `inventory_slot`, `bank_slot`, `quest_progress`, `guild`, `guild_member`, `exchange_order`, `trade_log`, **`item_ledger`** (item_id, qty, source, sink, actor, ts — every creation/destruction, no exceptions).
- Migrations via Prisma only. Nightly automated dump to object storage + a tested restore script (a backup you've never restored is a rumor).

## Content pipeline (how one person ships MMO content)

- All game data = JSON in `/content`, zod-validated at server boot (boot FAILS on invalid content — never ship silently broken data).
- IDs are stable strings (`item.bronze_sword`). Content references checked at boot (a drop table can't point at a nonexistent item).
- Balance guardrail tests, e.g.: weapon DPS within ±10% of its tier curve; drop-table EV per kill within band; quest XP per minute within band. Claude Code batch-generates content; tests + your review gate it.

## Security & anti-cheat checklist (recheck at every phase exit)

1. Server-authoritative state only — client values are *suggestions about intent*, never facts
2. zod on every message; rate limits per type; size caps; kick on repeated violations (logged)
3. Cooldowns/timers tracked in server ticks; speed/teleport sanity asserts each tick
4. Trades: escrow + double-confirm + immutable trade log; Exchange: orders escrow items/gold up front
5. `item_ledger` reconciliation job (daily): world inventory == created − destroyed, alert on drift
6. Auth: argon2 password hashing, signed short-lived session tokens (jose), token rotation on login
7. Secrets in env only; GM commands role-gated + audit-logged; admin actions reversible where possible
8. Assume a hostile client exists from day one, because by P5 one will

## Scaling path (don't pre-build, do pre-decide)

1. **P0–P10:** one server process, all rooms. Honest ceiling: a few hundred CCU at this sim complexity.
2. **P11:** interest management (only sync entities within ~20 tiles), district autoscaling, move zone groups to separate processes — Redis presence + transfer tickets already make this possible because globals never lived inside rooms.
3. **Far future:** regional processes, dungeon fleet autoscaling. Not designed now; just not blocked now.

## Testing strategy

- `server/src/sim/**`: pure functions, exhaustive Vitest (combat math, xp curves, pathfinding, drop rolls with seeded RNG).
- Schema tests: every MessageType has accept/reject cases.
- Bot harness (`/tools/bots`): N headless colyseus.js clients running walk/fight/gather scripts — used for load tests (phase exits) and smoke tests after refactors.
- Golden rule: a bug found in playtest gets a regression test before the fix is merged.
