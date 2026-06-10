# EMBERFALL — Game Design Document

> Reconciled 2026-06-10 against the full Emberfall starter kit (7 of 9 docs
> recovered; kit's ARCHITECTURE.md and PROGRESS.md were not — our working repo
> supersedes the kit's architecture anyway). This file is the design source of
> truth. Mechanics that the kit expressed in 600ms ticks are translated to our
> locked real-time architecture (see Locked Decisions).

A persistent online RPG: one shared world, one economy, hundreds of concurrent
players. 2D top-down, browser-first, free to play, no pay-to-win ever.

## One-liner

**Old School RuneScape's world and economy, Guild Wars' build system, WoW's
group content, FFXIV's combat readability — at a scope one person and Claude
Code can actually ship.**

## Player fantasy

You're a nobody homesteader on the frontier of **Vesper**, a continent still
scarred a century after the Emberfall — a night the sky burned and shattered
the old kingdoms. Frontier towns push into ember-scarred wilds where pre-Fall
ruins hold relics worth dying for. You become *a known name on a server where
reputation is real*: the smith whose blades everyone buys, the first to solo
the Cinder Depths, the guild that controls the Ashreach.

Tone: low-fantasy frontier. Cozy towns, dangerous wilds. Danger is always
opt-in and always signposted.

## Locked architecture decisions

Expensive to reverse. Do not reopen without explicit user request.

1. **Real-time 20 Hz authoritative server — NOT the kit's 600ms tile tick.**
   Decided 2026-06-10. Rationale: the most popular modern combat model
   (WoW/FFXIV/GW2), least clunky to modern hands; deliberate pacing comes from
   GCD tuning, not input quantization; the prediction/reconciliation netcode is
   already built and verified (M0/P0); scale comes from zone-sharding, not a
   slower simulation. Everything else in the kit survives this translation.
2. **Tab-target combat** tuned for FFXIV-style readability (GCD, telegraphs).
3. **Stack:** Phaser 3 + Vite client, Colyseus 0.17 Node server, `@mmo/shared`
   pure TypeScript systems with Vitest. Rooms = zones. Continuous coordinates;
   Tiled maps provide collision and layout.
4. **Content is data, not code** — typed TS data modules in `shared/src/data/`
   (compile-checked references; stronger than the kit's raw JSON, same
   principle). Adding a sword must never require editing combat code.

## Design pillars (every decision gets tested against these)

1. **One world, one economy.** No servers, no shards. One market, one set of
   hiscores, one reputation space. Crowding is solved with districts, never
   separate realms.
2. **Numbers you can feel.** Skills level by doing. Every level means
   something. Public hiscores for everything.
3. **Builds over classes.** Low power ceiling, wide horizontal pool. Mastery =
   the 8 abilities you chose, not the 80 hours you grinded past someone.
4. **Better with friends, never punishing alone.** Shared mob credit, party
   bonuses, group endgame — but every system has a solo path.
5. **Risk is a choice.** The best money and rarest drops live behind opt-in
   danger. Safe play is always viable.
6. **Respect the clock.** Sessions are productive at 15 minutes. Gathering has
   relaxed, AFK-friendly rhythms. No daily-login hostage-taking.

## Core loops

- **Minute loop:** travel → fight or gather → loot → manage inventory → bank.
- **Session loop (15–90 min):** pick one goal — a quest, a skill target, a
  dungeon run, a market play — finish it, see a number move.
- **Weekly loop:** Hunt assignments, guild dungeon night, market positions,
  leaderboard pushes, seasonal ladder (post-1.0).

## World structure

- The world is **zones** connected by exits. Each zone is a Colyseus room.
- v1.0 world: **4 overworld zones + 1 town + 1 dungeon.**
  - **Meadowbrook** — town, safe. (Current code's `verdant-vale` zone gets
    renamed/replaced in P1.)
  - **Greenreach** — level 1–20 fields.
  - **Tanglewood** — level 20–40 forest.
  - **The Ashreach** — 40+ **risk zone**.
  - **Cinder Depths** — instanced dungeon (3–5 players).
- **Districts (Guild Wars):** if a zone exceeds its cap (~100), a copy spawns
  ("Meadowbrook — District 2") with a switcher. Towns district freely; **risk
  zones never district** — scarcity and contested space are the point.
- Maps built in **Tiled**, 32px art, CC0/free packs (Kenney, OpenGameArt,
  itch.io) until the game earns custom art. Tiled provides collision grids and
  object layers; movement remains continuous on top.

## Time & simulation (real-time translation)

- Server simulates at a fixed **20 Hz**; clients predict locally and
  interpolate remotes (built and verified in P0).
- All game timing lives in shared constants as milliseconds:
  - **GCD:** ~1500ms on core combat abilities (FFXIV rhythm).
  - **Weapon identity** (kit's 3/4/5-tick ratio preserved): dagger ~1800ms
    fast/weak · sword ~2400ms · two-hander ~3000ms slow/huge. Auto-attack runs
    on weapon speed; abilities layer cooldowns on top.
  - **Gathering rhythm:** actions resolve on multi-second timers (e.g. a mining
    swing every ~2.4s) — preserves the kit's relaxed, semi-AFK skilling feel
    without a global tick.
- Big hits get **telegraphs ≥ 1s** (ground markers) — readable, dodgeable.
- Open-world TTK vs trash: ~10–20s. Deaths should teach, not insult.

## Progression: skills (RuneScape DNA)

**No classes. One character learns everything.** Skills level 1→50 by doing
(cap raised in expansions). XP curve roughly exponential; 50 is a real
achievement (~weeks, not months). (Supersedes M0's placeholder `ClassId` —
refactor lands with the skills system, P2.)

**Launch skills (8):**

| Skill | Trains by | Gates |
|---|---|---|
| Melee | melee damage dealt | melee weapons/abilities |
| Ranged | ranged damage | bows, thrown |
| Magic | spell damage/utility | staves, spells |
| Vitality | taking part in combat | max HP |
| Mining | mining nodes | ore tiers |
| Smithing | smelting/forging | metal gear crafting |
| Fishing | fishing spots | fish tiers |
| Cooking | cooking | food (combat healing) |

**Post-1.0 skills (one per content drop):** Woodcutting, Crafting, Alchemy,
Thieving. Adding a skill = an expansion's worth of content. Never two at once.

- **Total level** = sum of all skills → the prestige number on hiscores.
- **Rested bonus (WoW):** logged-off time accrues a +50% XP buffer.

## Combat & builds (Guild Wars DNA)

- **The 8-slot bar:** abilities unlock via skill levels, quests, drops, and
  trainers — a pool growing toward ~60 by 1.0. You slot **6 combat + 2
  utility**. Swap freely in safe zones. Build templates shareable as codes.
- **Resources:** HP (food heals — Cooking matters in combat) + **Energy**
  (regenerating, spent by abilities).
- **Resolution (OSRS math — simple, testable, architecture-agnostic):**
  accuracy roll vs. defence → on hit, damage roll up to max hit. Max hit scales
  with skill level + gear. Every formula is a pure function with unit tests in
  `shared/src/systems/`.
- **Threat:** simple aggro table per mob. Tank/healer/DPS *tendencies* emerge
  from build choices, never hard roles.
- **No kill-stealing (GW2):** everyone who meaningfully damages a mob gets full
  credit and a personal loot roll. Gathering nodes are per-player. Other
  players are never bad news.

## Items & economy (RuneScape + EVE/Albion DNA)

- **Rarity:** Common / Fine / Rare / Relic. Relics are pre-Fall uniques with
  build-warping effects — rare enough to be server news.
- **Crafting is the gear economy:** best non-Relic gear at every tier is
  *player-made*. Mobs drop materials + coins + occasional Fine/Rare.
- **Faucets:** mob coins, quest rewards, vendor-trash. **Sinks:**
  durability/repair, market tax (2%), fast-travel fees, consumables, dyes.
  Faucet/sink totals reviewed every phase — inflation is a design bug.
- **Trading ramp:** vendors (P5) → secure trade with escrow + confirm-twice
  (P8) → **the Exchange**: Grand-Exchange-style async order book (P8).
- **Death rules:** safe/normal zones — keep everything, durability hit. **Risk
  zones (Ashreach):** drop your 3 most valuable items + carried coins; killer
  loots them. Brutal, famous, *opt-in*.
- **Integrity:** every item creation/destruction writes to an audit ledger from
  the first item phase (P3). Dupe bugs end MMO economies.

## Content systems

- **Quests (WoW flow, RS soul):** quest-hub breadcrumbs teach the map; headline
  quests are *handcrafted set pieces* with puzzles, choices, and unique
  rewards. v1.0: ~25 quests, 5 spotlight, one **Main Story spine** (FFXIV)
  threading all zones.
- **NPCs & dialogue:** data-driven dialogue trees. Vendors, trainers,
  quest-givers, flavor NPCs with rotating barks.
- **Dungeon (WoW):** Cinder Depths — instanced, 3–5 players, ~30 min, 3 bosses,
  each with 2 learnable mechanics (telegraphed AoE, add phase, interrupt
  check). Daily loot lockout.
- **Mobs:** v1.0 = 14 families with variants (Emberlings, Ash Wolves, Bandits,
  Ruin Sentinels…). Behaviors composed from data: aggro radius, leash,
  special-attack cadence.

## Social

- **Chat:** zone, global (rate-limited + filtered), party, guild, whisper.
  Moderation from day one: mute, shadow-mute, report.
- **Parties (≤5):** shared XP within level range, loot modes, party quest
  credit.
- **Guilds:** name/tag/roster/ranks/chat (P6) → bank, hiscores, lockouts (P10+).
- **Hiscores:** public web leaderboards per skill + total level + boss KC.
  Public and crawlable — it's marketing.

## Endgame & retention

- **Hunts (OSRS Slayer):** assigned kill tasks for Hunt points → unique
  unlocks. Best retention loop in MMO history relative to dev cost. (P10)
- **Achievements + titles** (WoW), **cosmetics/dyes** (FFXIV glamour),
  **collection log** (OSRS). (P10)
- **Ironman / Hardcore Ironman:** self-sufficient and permadeath-flagged modes
  with marked hiscores. Cheap to build; creates the most dedicated players and
  stress-tests the solo economy. (P10)
- **Raid (P12):** 8-player, 5 bosses, weekly lockout, Relic-tier drops.
- **Seasonal ladders (PoE)** post-1.0: fresh-economy seasonal worlds that merge
  back. The proven answer to content droughts.
- **Battlegrounds / duels (P9):** opt-in structured PvP; risk zones are the
  open-world version.

## Explicitly CUT (the discipline list)

No 3D (until a far-future v2 graduation — systems carry over). No multiple
servers. No player housing before v2. No mounts before P11 (then speed +
cosmetic only). No flying ever. No gear-treadmill raid tiers (GW's low ceiling
instead). No pay-to-win, lockboxes, or energy systems — if it ever monetizes:
cosmetics and supporter perks only. No voice chat. No non-consensual open-world
PvP outside marked risk zones.

## v1.0 content budget

| Content | Target |
|---|---|
| Zones | 4 + town + 1 dungeon |
| Skills | 8 |
| Abilities | ~60 |
| Mob families | 14 |
| Items | ~120 |
| Quests | 25 (5 spotlight) |
| Concurrent players | 200 |
