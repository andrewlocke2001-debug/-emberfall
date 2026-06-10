# EMBERFALL — Roadmap

No dates (deliberately). **Order is law.** Each phase ends in something
playable and has exit criteria — a phase is not done until they pass. Claude
Code: never build features from a phase ahead of the one marked current in
`design/PROGRESS.md`.

> Reconciled 2026-06-10 from the starter kit, translated to the locked
> real-time architecture (20 Hz sim, continuous movement, GCD pacing — see
> `design/GDD.md` §Locked). Kit's tick-based bullets are restated in ms.

---

## P0 — Foundation: two dots in a shared world

**Goal:** the entire pipeline works end to end — code, netcode, persistence,
deploy.

- [x] Monorepo scaffold (npm workspaces: shared/server/client)
- [x] Colyseus zone room; real-time server-authoritative movement (20 Hz sim,
      client prediction + interpolation); movement intents validated/clamped
      server-side
- [x] Reconnect restores character (position/HP/level)
- [x] Vitest unit suite (shared systems) + Playwright two-client e2e; clean
      typecheck across workspaces
- [ ] **Postgres persistence via Prisma** (replaces the M0 JSON snapshot
      store): Player table (id, name, zone, x, y, created_at, last_seen);
      save on disconnect + every 30s
- [ ] **CI:** GitHub Actions — typecheck + test on push
- [ ] **Deploy:** server to Fly.io/Railway, Postgres managed (Neon/Railway),
      client static (Cloudflare Pages/Netlify)

**Exit:** you on your phone + a friend on theirs, over the real internet, see
each other walk. Server restart loses nothing. Forged movement messages are
rejected. *(Local two-tab version verified 2026-06-09.)*

## P1 — A world worth standing in

- Tiled-built maps for **Meadowbrook** + **Greenreach**, collision grid, zone
  exits (room-per-zone transfer); continuous movement over the collision grid;
  rename placeholder `verdant-vale`
- Real auth (username/password, argon2, signed sessions), display names above
  heads
- **zod validation on every inbound message** (kit rule #2 lands here),
  per-message-type rate limits
- Chat: zone + global; profanity filter, rate limits, mute command
- Player count + basic presence (districts NOT yet)

**Exit:** two people meet in town, talk, walk to Greenreach together, log out,
come back.

## P2 — Combat core ⚔️ *(the game becomes a game)*

- Real-time combat: auto-attacks by weapon speed (dagger ~1800ms / sword
  ~2400ms / 2H ~3000ms), **GCD ~1500ms**, 3 starter abilities, Energy, HP,
  death → respawn in town
- Mob system from data: spawns, aggro table, leash, respawn timers; 3 mob
  families
- XP for Melee + Vitality (skills replace the M0 `ClassId` placeholder);
  level-up toasts; **shared kill credit** (no kill-stealing)
- **Bot harness** (`npm run bots -- --count 50`): headless clients that walk +
  fight, for load and regression testing
- **GM commands v1:** teleport, spawn, heal, kick (role-gated, audit-logged)

**Exit:** you and a friend clear a camp together and both level up. 50 bots run
for an hour without server degradation.

## P3 — Stuff: items, inventory, loot

- Item definitions as typed data modules (schema-validated), inventory (28
  slots, stacking), equipment slots, stat application
- Drop tables, coin drops, ground loot with ownership timer
- Bank in town; **item ledger (economy audit) live from this phase**

**Exit:** kill mobs → loot upgrade → visibly hit harder → bank the rest.
Ledger reconciles: items in world = created − destroyed.

## P4 — Skilling: the RuneScape heart

- Mining, Smithing, Fishing, Cooking: per-player nodes/spots, tools, recipes,
  relaxed multi-second gather rhythms (~2.4s per action — semi-AFK feel)
- Food as combat healing; first crafted tier (bronze) competitive with drops
- Rested XP buffer (offline accrual, +50%)

**Exit:** a new player can mine ore, smith a bronze sword, cook trout, and take
it all into combat — full loop, zero drops required.

## P5 — Quests, NPCs, and the first 10 strangers

- Dialogue + quest framework (kill/collect/talk/explore), data-driven; quest
  log UI
- Starter arc: 10 quests incl. 1 handcrafted spotlight; vendors (faucet/sink
  tuning begins)
- Polish pass: sound, tutorial-by-design first 10 minutes, death explained
- **Soft launch: invite 10 real strangers.** Watch them play.

**Exit:** a stranger with no instructions reaches level 10, completes the
spotlight quest, and can tell you what the game is about.

## P6 — Social fabric

- Friends list, whispers, parties (shared XP/loot rules), emotes
- Guilds v1: create/invite/ranks/guild chat
- Hiscores website (public, crawlable — it's marketing)

**Exit:** a 4-person party quests for an hour; a guild of strangers exists that
you didn't create.

## P7 — Cinder Depths: first dungeon

- Instanced room-per-run, 3–5 players, 3 bosses with telegraphed mechanics
  (≥1s ground markers), dungeon loot table + daily lockout
- Tanglewood zone (20–40) to feed players toward it

**Exit:** a pickup group of strangers wipes, learns, and clears. Boss KC on
hiscores.

## P8 — The economy grows up

- Secure trade (escrow, confirm-twice, trade log)
- **The Exchange:** async order-book market (2% tax sink), price history
- Durability + repair costs; faucet/sink admin dashboard

**Exit:** a player gets rich *trading*, not grinding. Gold supply graph is
flat-ish.

## P9 — Opt-in danger

- Duels (formal accept)
- The Ashreach risk zone: best resources/drops; PvP-enabled; death drops 3
  most valuable + coins; never districts
- Anti-grief: level bands, spawn protection, skull/bounty flags

**Exit:** the risk-reward debate is happening among players. Nobody is forced
in; plenty go anyway.

## P10 — The retention layer

- **Hunts** (Slayer-style tasks + point shop) — the flagship retention loop
- Achievements, titles, collection log, cosmetic dyes
- Ironman + Hardcore Ironman (marked hiscores)
- Build template share codes

**Exit:** weekly actives return without new content drops.

## P11 — Comfort & reach

- Mounts (speed + cosmetic), fast-travel network (gold sink), mobile wrapper
  (Capacitor); touch controls pass (tap-to-move + tap-target already work —
  polish them)
- Performance: interest management (AOI), district auto-scaling, latency
  review

**Exit:** 200 CCU load test passes; phone app installable.

## P12 — The mountain top

- 8-player raid (5 bosses, weekly lockout, Relic drops)
- Battleground (structured team PvP)
- World events v1 (scheduled zone invasions)

**Exit:** v1.0. The "best of every MMO" pitch is now literally true at this
scale.

## Post-1.0 menu (pick by player demand, one at a time)

Seasonal ladders (PoE) · new skills (Woodcutting → Alchemy → Thieving) ·
housing · guild halls · community polls · Steam release · new continent ·
**the 3D graduation question** (systems/server carry over).

---

## Parallel tracks (alongside every phase)

**Ops:** automated DB backups + restore drill (P0-deploy) · error tracking
(P2) · metrics dashboard: CCU, sim-step duration, msg rates (P3) · log
retention (P3) · load test before every phase exit from P5.

**Content:** from P3, batch-generate content (items/mobs/dialogue as typed
data) in dedicated sessions — user reviews numbers and flavor; tests validate
schemas and balance bounds (e.g. "no weapon DPS exceeds tier curve by >10%").

**Community:** Discord at P5 · devlog posts each phase · feedback triage
ritual · named playtesters get credits.
