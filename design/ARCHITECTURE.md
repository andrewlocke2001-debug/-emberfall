# EMBERFALL — Architecture

Technical law for this project. If code contradicts this doc, the code is
wrong or this doc gets amended (note it in `design/PROGRESS.md`).

> Recovered from the starter kit 2026-06-10 and translated to the locked
> real-time architecture. Where the kit said "600ms tick / tile / no
> prediction," this doc says what we actually run: 20 Hz continuous sim with
> client prediction (built and verified in P0).

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript strict, everywhere | one language, shared types |
| Client | Phaser 3 + Vite | proven 2D, browser-first |
| Server | Node + Colyseus 0.17 | room-based authoritative state sync |
| Sync | @colyseus/schema (`defineTypes`) | delta-compressed state patches |
| DB | Prisma — SQLite dev / Postgres prod | persistence, migrations |
| Cache/pubsub | Redis | global chat, presence, rate limits (enters ~P1–P6 as needed; required by multi-process P11) |
| Validation | zod (in `/shared`, from P1) | every message, every content module |
| Tests | Vitest + Playwright | sim + schema + e2e + bots |
| Maps | Tiled (.tmj) | zone authoring (P1) |
| Hosting | Fly.io (server), Neon PG, Netlify/CF Pages (client) | cheap, scalable enough |

## Monorepo layout (as built)

```
/client          Phaser app (rendering, input, prediction/interpolation — ZERO game rules)
/server
  /src/rooms     Colyseus rooms (netcode wiring only — no game math)
  /src/persistence  Prisma client + character store (services/ grows here: auth, ledger, chat)
  /src/generated Prisma client (gitignored, regenerated on install)
/shared
  /src/types     domain types + tuning constants (single source of truth)
  /src/systems   PURE game logic: movement, combat math, xp, drops — unit-tested,
                 reused by server (authority) AND client (prediction)
  /src/schema    Colyseus state classes (server imports values; client types only)
  /src/data      content as typed TS modules (items, mobs, abilities, quests)
  /src/protocol  message types + payload shapes (zod schemas from P1)
/design          GDD, roadmap, this doc, progress log
```

(Kit deltas: sim lives in `shared/`, not `server/src/sim` — prediction needs
it on both sides. Content is typed TS modules, not raw JSON — compile-checked
references; same data-not-code principle.)

## Authority model (the most important section)

**Client = renderer + intent sender. Server = the game.**

```
client                            server
  | -- move {dx,dy} ------------> validate/clamp → store as input
  | -- useAbility {id,target} --> validate → range/cooldown/(energy P2) check
  |                               every 50ms (20 Hz): integrate movement from
  |                               inputs, run mob AI, resolve combat via pure
  |                               shared systems, apply damage
  | <==== schema state patches (positions, hp) ====
  | <---- events: combat hits, (chat, loot, level-up later) ----
client predicts its own movement with the SAME shared stepPosition(),
reconciles to server state; remote entities interpolate between patches
```

- Server-side checks that must exist for every action: range, cooldown,
  resource cost, state legality (can't act while dead), ownership (can't
  drop items you don't have), and (where relevant) line-of-sight.
- Every inbound message: validate (zod from P1) → reject+log on failure →
  per-type rate limit (e.g. move ≤ 30/s, chat ≤ 1 per 2s) → size caps.

## Simulation

- Fixed 20 Hz step (`TICK_MS` in shared constants). All gameplay timing in ms
  constants — GCD ~1500, weapon speeds 1800/2400/3000, telegraphs ≥1000.
- Each room runs its own loop. **Step budget: <50ms per step per room**; log
  a metric, alert when exceeded (this is the sharding tripwire).
- RNG: seeded per room (seed logged) → deterministic replays for bug reports
  and sim tests (lands with the first random system — drops, P3).

## World topology: zones as rooms

- One Colyseus room per zone instance: `world:greenreach`,
  `world:greenreach:d2` (districts), `dungeon:cinder:<runId>`.
- Zone transfer = leave room A, server hands a signed transfer ticket, join
  room B at the linked exit point. (P1/P3)
- **Districts:** spawn `:d2` when occupancy > cap (~100); switcher in towns.
  Risk zones never district.
- Global systems (global chat, whispers, Exchange, guilds, presence) live
  OUTSIDE rooms: Redis pub/sub + Postgres. Rooms subscribe to what they need.
  This rule is why multi-process scaling (P11) stays possible.

## Persistence

- **Write-behind for player state:** gameplay mutates in-memory room state;
  dirty players flush to DB every 15–30s, on leave, and on zone transfer.
  (Built: snapshot interval + onLeave save.)
- **Economy is NEVER write-behind:** items, trades, Exchange orders, and
  ledger entries write synchronously/transactionally (from P3).
- Core tables (grow as phases land): `player` (built) → `player_skill`,
  `item_instance`, `inventory_slot`, `bank_slot`, `quest_progress`, `guild`,
  `guild_member`, `exchange_order`, `trade_log`, **`item_ledger`** (item,
  qty, source/sink, actor, ts — every creation/destruction, no exceptions).
- Migrations via Prisma only. From first deploy: nightly automated dump +
  a TESTED restore script (a backup you've never restored is a rumor).

## Content pipeline (how one person ships MMO content)

- All game data = typed TS modules in `shared/src/data/`, compile-checked
  (a drop table cannot reference a nonexistent item — build error). Runtime
  zod validation guards any externally-loaded content (Tiled maps).
- IDs are stable strings (`item.bronze_sword`).
- Balance guardrail tests: weapon DPS within ±10% of tier curve; drop-table
  EV per kill within band; quest XP/min within band. Claude Code
  batch-generates content; tests + user review gate it.

## Security & anti-cheat checklist (recheck at every phase exit)

1. Server-authoritative state only — client values are *suggestions about
   intent*, never facts
2. Validation on every message; rate limits per type; size caps; kick on
   repeated violations (logged)
3. Cooldowns/timers tracked server-side; speed/teleport sanity asserts per step
4. Trades: escrow + double-confirm + immutable trade log; Exchange: orders
   escrow items/gold up front
5. `item_ledger` reconciliation job (daily): world inventory == created −
   destroyed; alert on drift
6. Auth: argon2 password hashing, signed short-lived session tokens, rotation
   on login (P1)
7. Secrets in env only; GM commands role-gated + audit-logged
8. Assume a hostile client exists from day one, because by P5 one will

## Scaling path (don't pre-build, do pre-decide)

1. **P0–P10:** one server process, all rooms. Honest ceiling: a few hundred
   CCU at this sim complexity.
2. **P11:** interest management (only sync entities within ~600 world units),
   district autoscaling, zone groups on separate processes — possible because
   globals never lived inside rooms (Redis presence + transfer tickets).
3. **Far future:** regional processes, dungeon fleet autoscaling. Not designed
   now; just not blocked now.

## Testing strategy

- `shared/src/systems/**`: pure functions, exhaustive Vitest (combat math,
  xp curves, movement, drop rolls with seeded RNG).
- Protocol tests: every message type gets accept/reject cases (with zod, P1).
- Playwright e2e: multi-client sync + persistence (built, 2 specs).
- Bot harness (P2): N headless SDK clients running walk/fight scripts — load
  tests at phase exits, smoke tests after refactors.
- Golden rule: a bug found in playtest gets a regression test before the fix
  is merged.
