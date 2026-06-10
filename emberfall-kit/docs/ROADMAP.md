# EMBERFALL — Roadmap

No dates (deliberately). **Order is law.** Each phase ends in something playable and has exit criteria — a phase is not done until they pass. Claude Code: never build features from a phase ahead of the one marked current in `docs/PROGRESS.md`.

---

## P0 — Foundation: two dots in a shared world
**Goal:** the entire pipeline works end to end — code, netcode, persistence, deploy.
- Monorepo scaffold (see BOOTSTRAP.md), Colyseus world room, tile movement at 600ms tick, server-side validation
- Postgres persistence of player position; reconnect restores state
- CI (typecheck + test), deployed to real hosting (Fly.io/Railway + Neon/managed PG + static client hosting)
**Exit:** you on your phone + a friend on theirs, over the real internet, see each other walk. Server restart loses nothing. Forged movement messages are rejected.

## P1 — A world worth standing in
- Tiled-built maps for Meadowbrook + Greenreach, collision, zone exits (room-per-zone transfer)
- Real auth (username/password, argon2, signed sessions), display names above heads
- Chat: zone + global via pub/sub; profanity filter, per-channel rate limits, mute command
- Player count + basic presence; districts NOT yet (cap not a problem at 10 players)
**Exit:** two people can meet in town, talk, walk to Greenreach together, log out, come back.

## P2 — Combat core ⚔️ *(the game becomes a game)*
- Server-tick combat: auto-attacks by weapon speed, 3 starter abilities, energy, HP, death → respawn in town
- Mob system from `/content` data: spawns, aggro, leash, respawn timers; 3 mob families
- XP for Melee + Vitality; level-up toasts; shared credit (no kill-stealing)
- **Bot harness** (`pnpm bots`): headless clients that walk + fight, for load and regression testing
- **GM commands v1:** teleport, spawn, heal, kick (role-gated, audit-logged)
**Exit:** you and a friend clear a goblin camp together and both level up. 50 bots run for an hour without server degradation.

## P3 — Stuff: items, inventory, loot
- Item definitions in `/content` (zod-validated), inventory (28 slots, stacking), equipment slots, stat application
- Drop tables, coin drops, ground loot with ownership timer
- Bank in town (large storage), item ledger (economy audit) live from this phase
**Exit:** kill mobs → loot upgrade → visibly hit harder → bank the rest. Ledger reconciles: items in world = items created − destroyed.

## P4 — Skilling: the RuneScape heart
- Mining, Smithing, Fishing, Cooking: nodes/spots (per-player), tools, recipes, tick-rhythm gathering
- Food as combat healing (Cooking matters); first crafted-gear tier (bronze) competitive with drops
**Exit:** a new player can go mine ore, smith a bronze sword, cook trout, and take it all into combat — full loop, zero drops required.

## P5 — Quests, NPCs, and the first 10 strangers
- Dialogue + quest framework (kill/collect/talk/explore objectives) fully data-driven; quest log UI
- Starter arc: 10 quests in Meadowbrook/Greenreach incl. 1 handcrafted spotlight quest; vendors (faucet/sink tuning begins)
- Polish pass: sound, tutorial-by-design first 10 minutes, death explained
- **Soft launch: invite 10 real strangers** (a Discord, a subreddit, friends-of-friends). Watch them play. Fix what confuses them.
**Exit:** a stranger with no instructions reaches level 10 and completes the spotlight quest, and can tell you what the game is about.

## P6 — Social fabric
- Friends list, whispers, parties (shared XP/loot rules), emotes
- Guilds v1: create/invite/ranks/guild chat
- Hiscores website (public, crawlable — it's marketing)
**Exit:** a 4-person party quests together for an hour; a guild of strangers exists that you didn't create.

## P7 — Cinder Depths: first dungeon (WoW DNA lands)
- Instanced room-per-run, 3–5 players, 3 bosses with telegraphed mechanics, dungeon loot table + daily lockout
- Tanglewood zone (level 20–40) to feed players toward it
**Exit:** a pickup group of strangers wipes, learns, and clears. Boss KC on hiscores.

## P8 — The economy grows up
- Secure trade (escrow, confirm-twice, trade log)
- **The Exchange:** async order-book market (buy/sell offers, 2% tax sink), price history charts
- Durability + repair costs; faucet/sink dashboard for you (admin)
**Exit:** a player gets rich *trading*, not grinding. Gold supply graph is flat-ish, not hockey-sticking.

## P9 — Opt-in danger
- Duels (anywhere, formal accept)
- The Ashreach risk zone: best resources + drops in game; PvP-enabled; death drops 3 most valuable + coins; no districts
- Anti-grief: level-band restrictions, spawn protection, bounty/skull system (attackers flagged)
**Exit:** the risk-reward debate is happening among players. Nobody is forced in; plenty go anyway.

## P10 — The retention layer
- **Hunts** (Slayer-style task system + point shop) — the flagship retention loop
- Achievements, titles, collection log, cosmetic dyes
- Ironman + Hardcore Ironman modes (marked hiscores)
**Exit:** weekly active players return without new content drops. Someone's in your Discord arguing about optimal Hunt blocking.

## P11 — Comfort & reach
- Mounts (speed + cosmetic), fast-travel network (gold sink), mobile wrapper (Capacitor) for app stores
- Performance pass: interest management (AOI), district auto-scaling, regional latency review
**Exit:** 200 CCU load test passes; phone app installable.

## P12 — The mountain top
- 8-player raid (5 bosses, weekly lockout, Relic drops)
- Battleground (structured team PvP)
- World events v1 (GW2 dynamic-event-lite: zone invasions on a schedule)
**Exit:** v1.0. The "best of every MMO" pitch is now literally true at your scale.

## Post-1.0 menu (pick by player demand, one at a time)
Seasonal ladders (PoE) · new skill expansions (Woodcutting → Alchemy → Thieving) · player housing · guild halls · community content polls (OSRS-style) · Steam release · new continent.

---

## Parallel tracks (run alongside every phase)

**Ops track:** automated DB backups + restore drill (P1) · error tracking, e.g. Sentry (P2) · metrics dashboard: CCU, tick duration, msg rates (P3) · log retention (P3) · load test before every phase exit from P5.

**Content track:** from P3 onward, batch-generate content with Claude Code (items/mobs/dialogue as JSON) in dedicated content sessions — you review numbers and flavor, tests validate schemas and balance bounds (e.g., "no weapon's DPS exceeds tier curve by >10%").

**Community track:** Discord at P5 · devlog posts each phase (they recruit players) · feedback channel triage ritual · named playtesters get credits.
