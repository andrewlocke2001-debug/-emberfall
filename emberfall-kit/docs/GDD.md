# EMBERFALL — Game Design Document

Working title. A persistent online RPG: one shared world, one economy, hundreds of concurrent players. 2D top-down, browser-first (desktop + phone), free to play, no pay-to-win ever.

## One-liner

**Old School RuneScape's world and economy, Guild Wars' build system, WoW's group content — at a scope one person and Claude Code can actually ship.**

## Player fantasy

You're a nobody homesteader on the frontier of **Vesper**, a continent still scarred a century after the Emberfall — a night the sky burned and shattered the old kingdoms. Frontier towns push into ember-scarred wilds where pre-Fall ruins hold relics worth dying for. You become *a known name on a server where reputation is real*: the smith whose blades everyone buys, the first to solo the Cinder Depths, the guild that controls the Ashreach.

Tone: low-fantasy frontier. Cozy towns, dangerous wilds. Danger is always opt-in and always signposted.

## Design pillars (every decision gets tested against these)

1. **One world, one economy.** No servers, no shards. Everyone shares one market, one set of hiscores, one reputation space. Crowding is solved with districts (see GDD §World), never with separate realms.
2. **Numbers you can feel.** Skills level by doing. Every level means something. Public hiscores for everything.
3. **Builds over classes.** Low power ceiling, wide horizontal pool. Mastery = the 8 abilities you chose, not the 80 hours you grinded past someone.
4. **Better with friends, never punishing alone.** Shared mob credit, party bonuses, group endgame — but every system has a solo path.
5. **Risk is a choice.** The best money and rarest drops live behind opt-in danger (risk zones, hardcore modes). Safe play is always viable.
6. **Respect the clock.** Sessions are productive at 15 minutes. Skilling has AFK-friendly rhythms (OSRS-style). No daily-login psychological hostage-taking.

## Core loops

- **Minute loop:** travel → fight or gather → loot → manage inventory → bank.
- **Session loop (15–90 min):** pick one goal — a quest, a skill target, a dungeon run, a market play — finish it, see a number move.
- **Weekly loop:** Hunt assignments (see Hunts), guild dungeon night, market positions, leaderboard pushes, seasonal ladder (post-1.0).

## World structure

- The world is **zones** connected by exits. Each zone is a server room (see ARCHITECTURE).
- v1.0 world: **4 overworld zones + 1 town + 1 dungeon.** Meadowbrook (town, safe), Greenreach (lvl 1–20 fields), Tanglewood (20–40 forest), The Ashreach (40+ **risk zone**), Cinder Depths (instanced dungeon).
- **Districts (Guild Wars):** if a zone exceeds its player cap (~100), a copy spawns ("Meadowbrook — District 2") with a switcher. Towns district freely; **risk zones never district** — scarcity and contested space are the point.
- Tile-based maps built in **Tiled**, 32px art. Free/CC0 packs (Kenney, OpenGameArt, itch.io bundles) until the game earns custom art.

## Time & simulation

- **World tick: 600ms.** All actions resolve on ticks: movement (1 tile/tick walk, 2 run), attacks (per-weapon tick speed), gathering, cooking. This is OSRS's proven cadence — forgiving for netcode, perfect for phones, and it makes "efficiency" itself a skill players optimize.

## Progression: skills (RuneScape DNA)

No classes. One character learns everything. Skills level 1→50 by doing (cap raised in expansions). XP curve roughly exponential; 50 is a real achievement (~weeks, not months).

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

**Post-1.0 skills (one per content drop):** Woodcutting, Crafting (leather/jewelry), Alchemy (potions), Thieving, and **Hunts** (Slayer-style — see Endgame). Adding a skill = a whole expansion's worth of content. Never launch two at once.

- **Total level** = sum of all skills → the prestige number on hiscores (RS DNA).
- **Rested bonus (WoW):** logged-off time accrues +50% XP buffer. Respects the clock; rewards coming back, not staying hostage.

## Combat & builds (Guild Wars DNA)

- **The 8-slot bar:** abilities are unlocked via skill levels, quests, drops, and trainers — a pool growing toward ~60 by 1.0. You slot **6 combat + 2 utility** abilities. Swap freely in safe zones. Build templates shareable as codes (GW classic).
- **Resources:** HP (food heals — Cooking matters in combat) + Energy (regenerating, spent by abilities).
- **Resolution (OSRS math — simple, testable):** accuracy roll vs. defence → on hit, damage roll up to max hit. Max hit scales with skill level + gear. Every formula is a pure function with unit tests.
- **Weapon identity:** dagger = 3-tick fast/weak; sword = 4; 2H = 5-tick slow/huge. Auto-attack runs on weapon speed; abilities layer on cooldowns measured in ticks.
- **Threat:** simple aggro table per mob. Tank/healer/DPS *tendencies* emerge from build choices, never hard roles.
- **No kill-stealing (GW2):** everyone who meaningfully damages a mob gets full credit and a personal loot roll. Gathering nodes are per-player. Other players are never bad news.

## Items & economy (RuneScape + EVE/Albion DNA)

- **Rarity:** Common / Fine / Rare / Relic. Relics are pre-Fall uniques with build-warping effects — rare enough to be server news.
- **Crafting is the gear economy:** the best non-Relic gear at every tier is *player-made*. Mobs drop materials + coins + occasional Fine/Rare; smiths make the meta.
- **Faucets:** mob coins, quest rewards, vendor-trash. **Sinks:** durability/repair, market tax (2%), fast-travel fees, consumables, cosmetic dyes. Faucet/sink totals reviewed every phase — inflation is a design bug.
- **Trading ramp:** vendors (P5) → secure player trade with escrow + confirm-twice (P8) → **the Exchange**: RS Grand-Exchange-style async order book, the endgame of the economy (P8).
- **Death rules:** safe/normal zones — keep everything, durability hit. **Risk zones (Ashreach):** drop your 3 most valuable items + carried coins; killer loots them (RS Wilderness / Albion). Brutal, famous, *opt-in*.
- **Integrity:** every item creation/destruction hits an audit ledger from day one. Dupe bugs end MMO economies.

## Content systems

- **Quests (WoW flow, RS soul):** quest-hub breadcrumbs teach the map and systems; but headline quests are *handcrafted set pieces* with puzzles, choices, and a unique reward (RS philosophy: quests are content, not chores). v1.0: ~25 quests, 5 of them handcrafted spotlights, one **Main Story spine** (FFXIV) threading all zones.
- **NPCs & dialogue:** data-driven dialogue trees in `/content`. Vendors, trainers, quest-givers, flavor NPCs with rotating barks.
- **Dungeon (WoW):** Cinder Depths — instanced, 3–5 players, ~30 min, 3 bosses, each with 2 learnable mechanics (telegraphed AoE, add phase, interrupt check). Loot lockout per day per character.
- **Mobs:** v1.0 = 14 families with variants (Emberlings, Ash Wolves, Bandits, Ruin Sentinels...). Behaviors composed from data: aggro radius, leash, special-per-N-ticks.

## Social

- **Chat:** zone, global (rate-limited + filtered), party, guild, whisper. Moderation tools from day one: mute, shadow-mute, report.
- **Parties (≤5):** shared XP within level range, loot mode options, party-wide quest credit.
- **Guilds:** name/tag/roster/ranks/guild chat (P6) → guild bank, guild hiscores, guild dungeon lockouts (P10+).
- **Hiscores:** public web leaderboards per skill + total level + boss KC. RS proved this is *the* long-game motivator.

## Endgame & retention (post-core)

- **Hunts (OSRS Slayer):** an NPC assigns "kill 40 Ash Wolves" style tasks for Hunt points → unique unlocks. The single best retention loop in MMO history relative to its dev cost.
- **Achievements + titles** (WoW), **cosmetics/dyes** (FFXIV glamour energy), **collection log** (OSRS).
- **Ironman / Hardcore Ironman modes:** self-sufficient (no trading) and permadeath-flagged characters with marked hiscores. Costs almost nothing to build; creates your most dedicated players *and* stress-tests whether the solo game economy works.
- **Raid (P12):** 8-player, 5 bosses, weekly lockout, Relic-tier drops.
- **Seasonal ladders (Path of Exile)** post-1.0: fresh-economy seasonal worlds that merge back into the main world. The proven answer to "MMO content droughts."
- **Battlegrounds / duels** (P9): opt-in structured PvP; risk-zone PvP is the open-world version.

## Explicitly CUT (the discipline list)

No 3D. No multiple servers. No player housing before v2. No mounts before P11 (then: speed + cosmetic only). No flying ever. No gear-treadmill raid-tier inflation (GW's low ceiling instead). No pay-to-win, no lockboxes, no energy systems — if it ever monetizes, it's cosmetics and supporter perks only. No voice chat. No open-world non-consensual PvP outside marked risk zones.

## v1.0 content budget (concrete targets)

| Content | Target |
|---|---|
| Zones | 4 + town + 1 dungeon |
| Skills | 8 |
| Abilities | ~60 |
| Mob families | 14 |
| Items | ~120 |
| Quests | 25 (5 spotlight) |
| Concurrent players | 200 |
