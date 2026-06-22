# EMBERFALL — Progress Log

Living log. Update at the end of every session: what shipped, decisions made,
next up. This file is how any session (or month-long absence) knows exactly
where the project stands.

## Current phase

**P0 CLOSED ✅ (desktop-verified 2026-06-14)** — user played the live game at
https://emberfall-server.fly.dev on desktop: spawns, moves, world renders.
The hard part (real-time authoritative multiplayer over the internet) is
proven. One URL serves client + websocket (no Netlify). Single Fly machine
(keep at 1 until P11 Redis).

**Now: P1 — "A world worth standing in."** Done: P1.1 (zod validation),
P1.2 (ASCII→Tiled maps + collision), mobile touch controls, **P1.3 complete**
— real Meadowbrook/Greenreach rendered in-game with collision; map-driven
spawns/dummies; **zone travel** (one Colyseus room per zone; stepping on a
gate sends a Transfer → client re-boots into the target zone at the named
entry; Player.zone persisted; arrival spawns at the entry, blocked/cross-zone
saved positions fall back to the default entry). 34 unit + 2 e2e green.
**P1 COMPLETE (local).** Done: P1.1 zod validation, P1.2 maps+collision,
mobile touch controls, P1.3 zones+travel, P1.4 accounts/auth (argon2 + JWT,
guest + login/register), **P1.5 chat** — zone + global broadcast, obscenity
profanity filter, 5/10s rate limit, DOM chat UI (channel toggle, focus pauses
movement) + zone HUD (name + player count); global chat crosses rooms via a
process-local EventEmitter bus (Redis swap-in seam for P11). 38 unit + 4 e2e
green; typecheck clean.

The kit's P1 exit ("two people meet in town, talk, walk to Greenreach
together, log out, come back") is functionally met — verified locally, NOT
yet on real devices because we're not deployed.

## P1.6 close-out — remaining
- **Deploy** (blocked): Fly trial ended; add a card (~$0–5/mo) → redeploy →
  on-device P1 exit test. Everything since the empty-grid version is local-only.

## P2 — combat core (in progress, local)
- **P2.1 done**: stat-based combat math (hitChance/maxHit/resolveAttack) + XP
  curve + skill→stat helpers, pure & tested.
- **P2.2 done**: mob roster (emberling/wolf/bandit + passive dummy) spawned
  from map markers; mob AI (aggro/chase/attack-on-cadence/leash-home);
  players take damage, die → respawn at the zone entry; mobs respawn home;
  client mob colors + dead-dimming + death banner. Greenreach is now
  dangerous; Meadowbrook stays safe. 51 unit + 5 e2e green (new mob-aggro e2e).
- **P2.3 done**: 3 data-driven abilities (Strike, Power Strike, Mend) with an
  Energy resource (+regen), a ~1.5s global cooldown + per-ability cooldowns
  (server-authoritative); strike/power are stat-based (resolveAttack), Mend is
  an off-GCD self-heal. Client ability bar (energy meter, cooldown sweeps,
  keys 1/2/3 + click/tap, Space = Strike) + green heal numbers. 51 unit + 6
  e2e green (new energy-spend e2e).
- **P2.4 done**: XP, leveling & **shared kill credit** (GW2-style). Two skills
  now live on the synced PlayerSchema as XP totals (`meleeXp`, `vitalityXp`);
  Melee level (= `level`) drives combat stats, Vitality level drives maxHp
  (a Vitality level-up raises maxHp and heals by the gain). Every player who
  lands a hit on a mob is tagged a contributor; on death ALL contributors get
  full XP (`gainXp` on the shared RS curve) — no last-hit stealing. Level-ups
  send a `LevelUp` message → gold client toast; HUD shows ⚔/♥ levels. XP
  persists (Prisma `add_skills` migration: `meleeXp`/`vitalityXp` Int default 0,
  applied to Neon via `migrate deploy`). 56 unit + 6 e2e green; typecheck clean.
- **P2.5 done**: **bot harness** + **GM commands v1** — closes the P2 combat
  core (local).
  - **Bots** (`npm run bots -- --count 50`): `tools/bots.ts`, headless Colyseus
    SDK clients that guest-auth, join a zone, and send the *same* move/strike
    intents a browser does (server can't tell them apart). Flags: `--count`,
    `--zone` (default greenreach), `--server`, `--duration`. Auto-reconnect,
    staggered connects, periodic stats, graceful SIGINT shutdown. Smoke-verified
    4 bots connecting + fighting locally. (Debt: each bot makes a guest account;
    big runs need a throwaway Neon branch.)
  - **GM commands** (`/heal [name]`, `/tp <x> <y>`, `/spawn <kind>`, `/kick
    <name>`): role-gated by the `GM_USERNAMES` env allowlist (no DB column —
    a client can never grant itself GM), parsed by pure shared helpers
    (`@mmo/shared/systems/gm`), executed server-authoritatively in ZoneRoom,
    audit-logged to the server console. Slash messages are intercepted before
    the chat path (never broadcast); non-GMs get a private refusal. Replies use
    a "System" chat line (reuses chat UI). 63 unit + 8 e2e green (new gm.spec:
    GM spawns a mob / non-GM is blocked).
- **P2 combat core COMPLETE (local).** Remaining P2 exit step is a *manual*
  load soak: 50 bots for an hour without server degradation (run once deploy is
  unblocked / against a throwaway DB).

## P3 — items, inventory, loot (in progress, local)
- **P3.1 done**: item model + inventory system + **economy ledger** foundation.
  - `shared/data/items.ts` — typed item roster (rarity, maxStack, value, equip
    slot, bonuses, heal); starter set (coins, bronze/iron sword, leather body,
    bronze helm, health potion, materials). `shared/systems/inventory.ts` — pure
    28-slot stacking add/remove/count/canAdd (10 unit tests).
  - Inventory is delivered to its owner via a private `Inventory` message (NOT
    synced ZoneState — bags aren't broadcast to everyone). Server holds the
    authoritative per-session inventory, loads it on join, persists on
    leave/snapshot (Prisma `inventory` JSONB column).
  - **Economy ledger** (`LedgerEntry` table + `persistence/ledger.ts`): every
    item create/destroy appends a row (kit rule #6). First creation path is GM
    `/give <itemId> [qty]` (audited, `reason: "gm_give"`).
  - Client: DOM inventory panel (toggle **I**), 28-slot grid with rarity tints +
    qty badges. Migration `add_inventory_and_ledger` applied to Neon. 73 unit +
    10 e2e green (new inventory.spec: GM /give + reload-persistence).
- **P3.2 done**: equipment slots + **stat application**.
  - `shared/systems/equipment.ts` — pure equip/unequip (bag↔slots, with swap) +
    `equipmentBonus` (sums attack/strength/defence/maxHp of worn gear); 9 unit
    tests. 8 slots (weapon/head/body/legs/hands/feet/ring/amulet).
  - Equipment is server-authoritative, off synced state (private `Equipment`
    message like inventory), persisted as a Prisma JSONB column. Equip/unequip
    are validated zod messages; the server recomputes maxHp (Vitality curve +
    gear) on every change, and combat now uses **effective stats** (gear
    bonuses) for the player as both attacker and defender.
  - Client: equipment strip in the inventory panel; click a bag item to equip,
    click a worn item to unequip. Migration `add_equipment`. 82 unit + 11 e2e
    green (new equipment.spec: equip body armor → maxHp +6 → unequip restores).
- **P3.3 done**: drop tables + ground loot + coin drops (**personal loot**).
  - `shared/systems/loot.ts` — pure `rollDrops` (per-entry chance + uniform qty,
    injected RNG; 5 unit tests). Each mob has a `drops` table in data/mobs.ts
    (coins + materials; bandit rarely a sword/potion; dummy nothing).
  - On death, **every contributor gets their own loot roll** (GW2-style, no
    steals) → `GroundLootSchema` piles in synced state at the mob, reserved to
    that player (`ownerId`/`ownerUntil`) for 60s, then public; despawn at 120s.
  - Pickup (`Pickup` zod message): server checks range + ownership, adds to the
    bag, and **ledgers the item into the economy on pickup** (reason `loot`) —
    unpicked loot that despawns is a non-event (nothing entered an inventory).
  - Client renders clickable loot piles; GM `/droploot <item> [qty]` for
    testing. No DB migration (ground loot is transient). 87 unit + 12 e2e green.
- **P3.4 done**: **town bank** + P3 close-out.
  - `shared/systems/bank.ts` — pure deposit/withdraw between bag and bank (round
    trip conserves totals; 7 unit tests). `addItem` generalized with a slot-cap
    arg so the 240-slot bank reuses it. Bank locations are data
    (`shared/data/banks.ts` + `nearBank`); Meadowbrook's is in the plaza.
  - Bank is server-authoritative, off synced state (private `Bank` message),
    persisted as a Prisma JSONB column. Deposit/Withdraw are zod messages,
    **gated by proximity to a bank** server-side. Bag↔bank is a transfer, so
    it's **not** ledgered — the ledger stays balanced.
  - Client: bank marker in town + a two-column bank panel (toggle **B** at a
    bank; click to deposit/withdraw). Migration `add_bank`. 94 unit + 13 e2e.
- **P3 COMPLETE (local).** Items, inventory, equipment+stats, loot/drops, and
  the bank all ship; the economy ledger has tracked every create/destroy since
  the first item. P3 exit ("kill → loot upgrade → hit harder → bank the rest")
  is mechanically in place.
- Also wrote `design/STORY.md` (the Main Story spine + lore) on 2026-06-19.

## Known follow-ups (deferred, not blocking)
- **Controls feel "wonky"** (user feedback) — prediction/reconciliation +
  camera tuning. Polish during/after P1.3 rendering work.
- **Phone stray-path 404** ("Cannot GET /Can" from URL autocomplete) — fixed
  with an SPA fallback in server/src/index.ts; ships with the next deploy.
  Bare URL https://emberfall-server.fly.dev already works on mobile.
- **Server uptime**: Fly still stops the idle machine despite auto_stop=false;
  mitigated by client wake-and-retry + keepwarm cron. If it recurs, consider
  moving prisma migrate out of boot (release_command) for fast cold starts.

## Shipped

### 2026-06-19 — P3.4 town bank (P3 complete) ✅
- Pure deposit/withdraw (7 unit tests; round-trip conserves totals); `addItem`
  generalized with a slot-cap arg for the 240-slot bank. Bank locations are data
  (`nearBank`); Meadowbrook's bank is in the plaza. Server-authoritative bank,
  off synced state (private Bank message), persisted (Prisma JSONB). Deposit/
  Withdraw zod messages gated by bank proximity; bag↔bank is a transfer so it's
  NOT ledgered (ledger stays balanced). Client bank marker + two-column panel
  (toggle B at a bank). Migration `add_bank`. 94 unit + 13 e2e (new bank.spec:
  /tp to bank → /give → deposit → withdraw round-trip).
- **P3 COMPLETE locally** — items/inventory/equipment/loot/bank + economy ledger.

### 2026-06-19 — P3.3 drop tables + ground loot + coins (personal loot) ✅
- Pure `rollDrops` (5 unit tests) + per-mob drop tables. On kill, every
  contributor gets their own roll (GW2 personal loot) → GroundLootSchema piles
  in synced state, owner-reserved 60s then public, despawn 120s. Pickup is a
  zod message, range + ownership checked server-side; the item is ledgered into
  the economy on pickup (reason `loot`) — unpicked despawned loot is a
  non-event. Client renders clickable piles; GM `/droploot` for testing. No DB
  migration (transient). 87 unit + 12 e2e (new loot.spec: drop → pickup → bag).
- Deviation: ground loot is shared synced state (everyone sees all piles, but
  pickup is owner-gated until the timer) rather than GW2's per-player-invisible
  loot — true filtered visibility needs Colyseus StateView, deferred. Auto
  walk-over pickup also deferred (click-to-pickup for now).

### 2026-06-19 — P3.2 equipment + stat application (+ STORY.md) ✅
- Pure equip/unequip/equipmentBonus system (9 unit tests); 8 gear slots.
  Equipment is server-authoritative, off synced state (private Equipment
  message), persisted (Prisma JSONB). Equip/unequip are zod-validated; the
  server recomputes maxHp (Vitality + gear) and applies gear bonuses to the
  player's effective combat stats as attacker *and* defender. Client equipment
  strip (click to equip/unequip). Migration `add_equipment`. 82 unit + 11 e2e.
- Test note: maxHp is a synced-schema field, so its delta can land just after
  the Equipment message — e2e polls maxHp rather than reading once.
- Wrote `design/STORY.md`: the world (Vesper, the Emberfall), factions, and the
  five-act Main Story spine (Meadowbrook→Greenreach→Tanglewood→Ashreach→Cinder
  Depths) with the central release/bind/tend choice. Narrative source of truth.

### 2026-06-19 — P3.1 items + inventory + economy ledger ✅
- Typed item roster + pure 28-slot stacking inventory (10 unit tests). Inventory
  delivered to its owner via a private `Inventory` message (off synced state),
  persisted as a Prisma JSONB column. Economy ledger (`LedgerEntry`) appends on
  every item create/destroy; GM `/give` is the first audited creation path.
  Client inventory panel (toggle I). Migration `add_inventory_and_ledger`.
- Bugs found + fixed while wiring it up (good lessons):
  - **JSONB read race**: the pg driver-adapter returns the `inventory` JSONB
    column as a *string*, not a parsed array — `parseInventory` now JSON.parses a
    string before validating (position persisted but inventory always loaded []
    until this fix).
  - **Join-race on initial state push**: a `client.send` in `onJoin` can land
    before the client registers its handler and get dropped (Welcome hid this
    because it's a no-op). Added a `RequestInventory` pull the client sends once
    its handlers exist — the reliable pattern for any per-client initial state.
  - **Missing DOM**: added inventory CSS without the `#inventory` markup → the
    panel constructor crashed every scene. (Always add the element, not just CSS.)
  - **Flaky combat e2e**: two-players fired 8 strikes at 250ms but the ~1.5s GCD
    let only ~2 land, and combat is noisy (~60% hit × 0..max damage), so it was
    ~35% likely to register zero damage — it had been passing on luck. Now it
    strikes on a GCD-spaced cadence until damage registers. (Combat itself is
    fine — verified server-side 200→198.)
- 73 unit + 10 e2e green; typecheck clean.

### 2026-06-17 — P2.5 bot harness + GM commands (P2 combat core complete) ✅
- **Bot harness** `tools/bots.ts` (`npm run bots -- --count 50 [--zone …]
  [--server …] [--duration …]`): headless Colyseus SDK clients that guest-auth
  via /auth/guest, join, and steer toward + Strike the nearest mob using the
  same intents a real client sends. Staggered connects, auto-reconnect on drop,
  10s stats heartbeat, graceful SIGINT/duration shutdown. Smoke-verified (4
  bots connect + fight locally). No new deps (reuses @colyseus/sdk + @mmo/shared
  via tsx, like the live-*.mjs tools).
- **GM commands v1**: `/heal [name]`, `/tp <x> <y>`, `/spawn <kind>`, `/kick
  <name>`. Role-gated by `GM_USERNAMES` env allowlist (comma-separated, case-
  insensitive) — set it via `fly secrets set GM_USERNAMES=…` for prod GMs;
  there is deliberately NO DB/GM flag a client could set. Pure parser + role
  check in `@mmo/shared/systems/gm` (unit-tested); effects run server-
  authoritatively in ZoneRoom and are audit-logged to the console. Slash
  messages are intercepted before chat (never broadcast); non-GMs get a private
  "System" refusal.
- 63 unit + 8 e2e green; typecheck clean. New `gm.spec` proves a GM can /spawn
  and a non-GM cannot (Playwright server runs with GM_USERNAMES="GMTest").
- **P2 combat core is functionally complete (local).** Outstanding P2 exit
  bullet is the manual 50-bot/1-hour soak (do against a throwaway Neon branch
  or after deploy is unblocked — bots create guest rows).

### 2026-06-16 — P2.4 XP, leveling & shared kill credit ✅
- `gainXp(currentXp, amount)` on the shared RS curve (clamps negatives, reports
  level + leveledUp) — 5 new unit tests.
- PlayerSchema gains synced `meleeXp` / `vitalityXp`; `level` is now the Melee
  level (drives combat stats), maxHp is derived from the Vitality level. Levels
  are recomputed from XP on join — the saved `level`/`maxHp` columns are
  denormalized convenience only, never trusted.
- ZoneRoom tracks per-mob contributor sets; landing a hit tags you; on death
  every living contributor is awarded full XP (`awardKill` → `grantXp`). A
  Vitality level-up raises maxHp and heals by the delta. Contributors cleared
  on death (after award) and on respawn; pruned on leave.
- `ServerMessage.LevelUp` (+ `LevelUpPayload {skill, level}`) sent only to the
  leveler → gold fading client toast; HUD shows ⚔/♥ levels (Vitality derived
  client-side with the same shared curve). Test API `me()` exposes XP + levels.
- Prisma `add_skills` migration (additive: `meleeXp`/`vitalityXp` Int default 0)
  applied to Neon via `migrate deploy`. 56 unit + 6 e2e green; typecheck clean.
- Exploit pass: XP is fully server-authoritative — it only flows from a real,
  in-range, GCD/energy/cooldown-gated hit resolved server-side, so a client
  can't grant itself XP, levels, or HP. Shared credit only includes sessions
  that actually damaged the mob; leavers are skipped on award (no dup, no
  crash) since their progress already persisted on leave.

### 2026-06-14 — P0 closed + the actual freeze fixed + P1.1/P1.2 ✅
- **Real root cause of "stuck on Entering" found via the user's browser
  console**: `ZoneScene.update()` read `room.state.players.get()` before the
  schema state had streamed in. Sub-ms on localhost (never failed locally),
  but on a remote server the first frames run pre-sync → `undefined.get()`
  throws → render loop freezes on the loading screen. Fixed with a guard in
  update() + optional chaining in the test API. **This was THE bug**; the
  earlier uptime/cold-start work was a separate, real issue.
- Game verified working on the user's desktop against the live server.
- SPA fallback added (server serves index.html for stray GET paths → phones
  that autocomplete a path no longer 404).
- **P1.1**: zod schemas validate every inbound message via Colyseus
  `onMessage(type, schema, handler)`; `maxMessagesPerSecond` flood ceiling.
- **P1.2**: `tools/mapgen` ASCII→Tiled-JSON compiler; Meadowbrook (40×40
  town) + Greenreach (60×60 fields) maps with collision/exits/spawn/enemy
  object layers; pure `systems/collision.ts` (axis-separated slide); 31 unit
  tests green (collision + map referential integrity).

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
