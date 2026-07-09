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

## P4 — skilling (in progress, local)
- **P4.1 done**: **Gathering — Mining + Fishing**.
  - Two new skills (`mining`, `fishing`) added to SKILL_IDS; XP synced on
    PlayerSchema (`miningXp`/`fishingXp`) + persisted (migration
    `add_gathering_skills`). Gathered ore/fish items added to data/items.ts.
  - Resource nodes are data (`shared/data/resources.ts`: defs + per-zone
    placements + `nearBank`-style lookup) — per-player and non-depleting, so
    they need no synced schema (client renders from data, server validates
    against it), mirroring the bank pattern. Meadowbrook has starter copper/tin
    rocks + a pond shrimp spot; Greenreach has more + iron + a trout spot.
  - `Gather` is a zod message; the server runs a ~2.4–3s timed gather that
    **auto-repeats** while you stand still in range (RS semi-AFK feel), yields
    one item per cycle (**ledgered**, reason `gather`), grants skill XP, and
    stops on move / out-of-range / full bag / level-too-low. Nodes gate on a
    minimum skill level.
  - Client: clickable node markers; HUD now shows ⚔/♥/⛏/🎣 levels; mining/
    fishing level-up toasts. 94 unit + 14 e2e (new gather.spec: /tp to the
    copper rock → mine → ore + Mining XP).
- **P4.2 done**: **Crafting — Smithing + Cooking + food healing**.
  - Two crafting skills (`smithing`, `cooking`) added; XP synced + persisted
    (migration `add_crafting_skills`). New items: bronze/iron bars, cooked
    shrimp/trout (with `heal`). Recipes are data (`shared/data/recipes.ts`):
    smelt bronze/iron, forge bronze sword/helm, cook shrimp/trout.
  - Pure `craft()` system (consume inputs → output, refuse if missing/full; 4
    unit tests). `Craft` is an instant zod message — server checks level + runs
    the pure craft, **ledgers inputs destroyed + output created** (rule #6),
    grants skill XP. `Consume` (eat) removes 1 food, heals up to maxHp (green
    +N), ledgered.
  - Client: crafting panel (toggle **C**) listing recipes with craftability;
    click a food item in the bag to eat it; HUD adds 🔨/🍳. The full
    gather→craft→eat loop works. 98 unit + 16 e2e (new craft.spec: smelt bronze
    bar + Smithing XP; cook shrimp + eat it).
  - **P4 exit met (mechanically)**: a new player can mine ore, smith a bronze
    sword, cook a fish, and take it into combat — zero drops required.
- **P4.3 done**: **rested XP** (WoW-style). Logged-off time banks a credit
  buffer (`restedAccrual`, +500/hr capped 10k) that adds **+50% XP** to every
  skill award until spent (`restedBonus`); both pure + unit-tested. `restedXp`
  synced + persisted (migration `add_rested_xp`); accrued on join from the prior
  `lastSeen` (loadOrCreate now reads-then-writes so it can see the old
  timestamp). Applied to all XP grants (combat + gathering + crafting). HUD shows
  a 💤 rested indicator. 103 unit + 16 e2e.
- **P4 COMPLETE (local)** — gathering, crafting, food healing, rested XP.

## P5 — quests, NPCs, vendors (in progress, local)
- **P5.1 done**: **quest framework** + quest log UI. Quests are data
  (`shared/data/quests.ts`: kill/collect/talk objectives, rewards, prereq
  chains). Pure quest system (`systems/quests.ts`: accept/canAccept/recordKill/
  objectiveStatus/questReady/completeQuest; 6 unit tests). Per-player quest log
  synced via a `Quests` message + persisted (migration `add_quests`). Server
  handles accept/complete (zod), advances kill objectives on mob death, checks
  collect objectives live vs the bag at turn-in, then consumes collect items +
  pays rewards (coins/items/XP) — all ledgered. Client quest log panel
  (toggle **J**) with live objective progress + accept/turn-in. 109 unit + 17
  e2e (new quest.spec). `talk` objectives + quest-givers wired in P5.2.
- **P5.2 done**: **NPCs + dialogue + quest-givers**. NPCs are data
  (`shared/data/npcs.ts`: placement + greeting + offered quests); Warden Mira +
  Dorin the Smith stand in Meadowbrook. `Talk` is a proximity-gated zod message;
  `recordTalk` (pure, tested) completes `talk` objectives. Client renders NPC
  markers; clicking opens a dialogue panel (greeting + accept/turn-in/status for
  that NPC's quests). No migration (talk uses the existing quest log). 110 unit
  + 18 e2e (new npc.spec). Full branching dialogue trees deferred (v1 =
  greeting + quest options).
- **P5.3 done**: **vendors** (coin faucet + sink). Vendors are data
  (`shared/data/vendors.ts`); Trader Bram in Meadowbrook sells potions/food/
  basic gear. Pure pricing (`systems/shop.ts`: buy = value, sell = 40% of value;
  3 unit tests). `Buy`/`Sell` are proximity-gated zod messages; the server
  checks coins/stock/space, moves coins↔items, and ledgers both sides (reasons
  `buy`/`sell`). Client shop panel (click a vendor) with Buy/Sell columns + a
  coin readout. No migration. 113 unit + 19 e2e (new vendor.spec).
- **P5.4 done**: **starter quest arc** + content-integrity test. Added
  `supper_for_the_inn` (fish→cook) and the spotlight capstone `the_ember_scar`
  (kill a bandit + collect ash pelts → 200c + an iron sword), forming a coherent
  Mira/Dorin arc: greet → mine → cook → smith/cull → spotlight. New
  `data/content.test.ts` validates every cross-reference (items/mobs/npcs/
  vendors/recipes/nodes/quests). 119 unit + 19 e2e.
- **P5 COMPLETE (local)** — quests, NPCs/dialogue, vendors, a starter arc.
  Deferred (need deploy + real people, or a later content pass): the soft-launch
  with 10 strangers (P5 exit, blocked on deploy); branching dialogue trees;
  expanding the arc toward the GDD's 25-quest target.

## P6 — social fabric (in progress, local)
- **P6.1 done**: **whispers** (private DMs). `/w <name> <text>` in chat (or the
  `Whisper` zod message). The sender's room censors + rate-limits (shared chat
  throttle), echoes to the sender, and publishes on the globalBus; whichever
  room holds the named recipient delivers — so whispers cross zones. Purple
  `[w] from » to:` lines in chat. No migration. 119 unit + 20 e2e (new
  whisper.spec: cross-context delivery + sender echo).
- **P6.2 done**: **friends list + presence**. Persisted per-player friends
  (JSON column, migration `add_friends`, capped 50, must name a real
  character). New process-local `presence` service (name → zone; registered on
  join, guard-unregistered on leave so zone transfers can't wipe it) — the
  second Redis seam for P11. `FriendAdd`/`FriendRemove`/`RequestFriends` zod
  messages → a `Friends` push with live online/zone per entry. Client friends
  panel (toggle **F**): add-by-name, green/grey presence dots, per-row remove.
  119 unit + 21 e2e (new friends.spec: add → online in meadowbrook → remove).
- **P6.3 done**: **parties + shared kill XP**. Pure `PartyRegistry` in
  `shared/systems/party.ts` (invite/accept/leave; cap 5; leader promotion;
  disband at 1; 5 unit tests) instanced once process-wide
  (`services/party.ts`). Invites require the target online; the invitee gets a
  System whisper + a roster push (`partyChanged` on the globalBus fans roster
  updates to whichever rooms hold the members — parties survive zone travel
  and brief relogs; members show offline via presence). **Shared XP**: on a
  mob death, party members of any tagger who are in the same zone, alive, and
  within PARTY_LEVEL_RANGE (10) melee levels get full kill XP + quest kill
  credit; **loot rolls stay tag-based**. Client party panel (toggle **P**):
  invite-by-name, accept banner, leader crown, presence, leave. 124 unit + 22
  e2e (new party.spec: invite → accept → shared roster → leave disbands).
- **P6.4 done**: **guilds v1** (durable). New `Guild` table (unique name +
  [TAG], leaderId) + `Player.guildId/guildRank` (migration `add_guilds`).
  Pure rules in `shared/systems/guild.ts` (name/tag validation, canKick,
  canSetRank; 4 unit tests). Create/invite/accept/leave/kick/set-rank are zod
  messages; invites are transient (target must be online, System whisper +
  panel refresh); leader leaving hands off to an officer (else first member);
  the last member out disbands (guild deleted). Rooms cache membership per
  session (DB is truth; `guildChanged` on the bus triggers a DB re-read +
  push; snapshots deliberately never write membership so a kick can't be
  clobbered). **Guild chat**: chat channel cycles zone→global→guild; guild
  lines fan out members-only via the bus. Client guild panel (toggle **G**):
  found form, accept banner, roster with 👑/⭐ ranks + presence, promote/
  demote + kick (rank-gated), leave. 128 unit + 23 e2e (new guild.spec: found
  → invite/accept → guild chat → disband).
- **P6.5 done**: **public hiscores**. The game server serves `/hiscores`
  (server-rendered, crawlable HTML — no client bundle) and `/api/hiscores`
  (JSON): top 50 per skill + a total-level board (ordered by summed XP; levels
  derived with the shared curve). Names HTML-escaped; read-only queries.
  128 unit + 24 e2e (new hiscores.spec: JSON rows ranked + HTML page).
- **P6 COMPLETE (local)** — whispers, friends+presence, parties+shared XP,
  guilds v1 + guild chat, public hiscores. The P6 exit ("a 4-person party
  quests for an hour; a guild of strangers exists that you didn't create")
  needs real players — deferred with the deploy, same as the P5 soft launch.

## P7 — Cinder Depths + Tanglewood (in progress, local)
- **P7.1 done**: **Tanglewood** — the level 20–40 forest east of Greenreach
  (60×60; dense tree corridors, old Accord ruins, a wraith pond). Greenreach's
  road now runs its full width to a new east gate; travel is
  meadowbrook ⇄ greenreach ⇄ tanglewood. Three new mob families in data:
  **Thorn Stalker** (20), **Ruin Sentinel** (30, armored, drops iron bars +
  rarely an **Ancient Relic** — new rare vendor-treasure item), **Ember
  Wraith** (38, fast hitter). Gathering: two iron rocks in the north glade + a
  guarded trout pool. mapgen gained chars t/r/m; maps.test now covers all
  three zones. 132 unit + 24 e2e; no migration (pure content).
- **P7.2 done**: **Cinder Depths — instanced dungeon**. New 40×40 dungeon map
  under the Tanglewood ruins (linear crawl; boss arena reserved for P7.3), a
  gate in the ruins and a south gate back out. Zones now split into overworld
  `ZONE_IDS` (one persistent room each) vs instanced `DUNGEON_IDS`; `mapForId`
  resolves either. The dungeon reuses `ZoneRoom` but is registered
  `.filterBy(["ticket"])`, so each party (or solo) gets its own instance. A
  server `dungeons` ticket service mints one unguessable ticket per party at
  the gate (shared by member signature within a TTL); `onJoin` rejects anyone
  the ticket doesn't name. Persistence rewrites a dungeon location to the
  overworld return entry, so a relog never strands in a dead instance;
  `maxClients` = party size. `TransferPayload.ticket` carries it into the join;
  the client renders dungeon maps (`mapForId`) and clears stale tickets on
  overworld travel. 136 unit + 25 e2e (new dungeon.spec: gate → distinct
  instanced room → return). No migration.
- **P7.3 done**: **dungeon boss — Warden of Ash** with **telegraphed attacks**.
  New boss mob (2400 HP, `boss:true`) holding the Cinder Depths north arena
  with two adds. `MobDef.telegraph` (windup/radius/damage/cooldown) drives a
  dodgeable AoE slam: the boss roots, `EnemySchema` streams the danger circle
  (teleAt/teleX/teleY/teleRadius), and on landing every player still inside
  takes the hit — move out and it whiffs. Cleared on death/respawn so a dead
  boss never slams. Client renders a pulsing red danger circle at the telegraph.
  Run reward = the boss drop table: guaranteed coins + 2–4 Ancient Relics and a
  50% **Cinderheart Amulet** (new relic-tier amulet, best neck slot). mapgen
  gained the `W` boss char. 136 unit + 26 e2e (new boss.spec: telegraph winds
  up, slam damages a standing player). No migration.
- Next: **P7.4** dungeon close-out (loot/reward polish, lockout or repeatable
  tuning) or **P8**.

## Single-player build (play-test track, alongside the roadmap)
- **Client-only solo mode** so the game is play-testable for free (Fly trial
  ended): `net/localRoom.ts` runs the whole game in-browser against the SAME
  shared systems + schema as the server ZoneRoom — movement/collision, combat,
  abilities, mob AI + boss telegraphs, death/respawn, loot, inventory,
  equipment, gather, craft, bank, quests, NPCs, vendors, zone travel + the
  instanced dungeon — persisting one character to localStorage. `net/mode.ts`
  `SOLO` (VITE_SOLO=1 at build, or `?solo` at runtime) makes `connectToZone`
  return a `SoloRoom` and `main.ts` skip login. Sandbox chat commands in solo:
  `/give /tp /spawn /heal`. Verified by `solo.spec` (runs, /give, equip→maxHp,
  mine ore, reload-persist) + full typecheck; the solo prod build succeeds.
- **Deploy**: `.github/workflows/pages.yml` builds the solo client
  (VITE_SOLO=1; vite base "./" already handles the /-emberfall/ subpath) and
  publishes to GitHub Pages → a shareable static link, $0. Removed
  `keepwarm.yml` (was pinging the dead Fly server every 5 min and emailing
  failures); scoped `ci.yml` to `main`.
- Also added a GM `/clearbag` command + `clearBag()` e2e helper so the shared
  GameMaster fixture's 28-slot bag can be reset (it had filled over the session,
  flaking the add-an-item tests).

## P8 — the economy (in progress, local)
- **P8.1 done**: **durability + repair** (a gold sink). Gear has `maxDurability`
  (`shared/systems/durability.ts`: hasDurability/wear/isBroken/repairCost/
  currentDurability/effectiveEquipment, 7 unit tests). Per-item durability
  (`{itemId: remaining}`) is tracked off synced state, persisted (JSONB column,
  migration `add_durability`). A landing swing wears the weapon; taking a hit
  wears a random armor piece; **broken gear (0) grants no bonus** (via
  effectiveEquipment in playerStats/maxHpFor). Repair all worn gear for coins at
  a vendor (`Repair` msg, ledgered sink) — button in the shop panel. Durability
  shown per gear slot in the equipment panel (worn/BROKEN styling). Fully
  mirrored in the solo engine. 143 unit + 28 e2e (new durability.spec: wear in
  combat → repair at vendor). Also fixed a stuck-dead GameMaster e2e fixture
  (enterWorldAsGm now `/heal`s on entry) — cleared 7 cascading failures.
- **P8.2 done**: **secure player-to-player trade**. Pure state machine
  (`shared/systems/trade.ts`, 4 tests) enforcing the confirm-twice invariant:
  ANY offer change clears BOTH confirmations. Server manages per-room trade
  sessions: request (proximity-gated, by name) → accept → each side sets a full
  offer (validated they hold it) → confirm-twice → **atomic swap** (re-validate
  holdings + bag space; all-or-nothing) with paired ledger entries (reason
  "trade", nets to zero = audit trail). Torn down on leave/death/zone-travel.
  Client trade panel (toggle **T**): request-by-name, accept/decline banner,
  your/their offers, add-from-bag + coins, confirm/cancel; auto-opens on a
  request. Solo: friendly "no one else here" message. 147 unit + 29 e2e (new
  trade.spec: GM trades a sword to a guest, confirm-twice, atomic swap).
- Next: **P8.3** the Exchange (async order book + tax sink), **P8.4**
  faucet/sink dashboard + close-out.

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

### 2026-06-26 — P6 social fabric complete ✅ (P6.1–P6.5)
- **Whispers** `/w name text` (cross-zone via the bus, censored + throttled).
- **Friends + presence** (persisted list, cap 50; process-local presence
  service with a transfer-safe unregister guard).
- **Parties + shared XP** (pure PartyRegistry, cap 5, leader promotion; roster
  fan-out via the bus; same-zone/level-range shared kill XP; loot stays
  tag-based).
- **Guilds v1** (durable: Guild table + membership on Player; ranks
  leader/officer/member with a pure permission matrix; transient invites;
  leadership hand-off + disband-when-empty; members-only guild chat channel;
  snapshots never write membership so kicks can't be clobbered).
- **Public hiscores** (/hiscores HTML + /api/hiscores JSON; per-skill + total).
- 128 unit + 24 e2e; typecheck clean. Migrations: add_friends, add_guilds.
- All social fan-out goes through globalBus/presence/parties seams → the P11
  Redis swap stays a services-layer change.

### 2026-06-24 — P4.3 rested XP (P4 complete) ✅
- WoW-style rested buffer: offline time banks credit (`restedAccrual`, capped)
  that adds +50% to every XP award until spent (`restedBonus`); both pure +
  unit-tested. `restedXp` synced + persisted (migration `add_rested_xp`),
  accrued on join from prior `lastSeen` (loadOrCreate reworked to read-then-
  write). Applied to combat + gathering + crafting XP. HUD 💤 indicator. 103
  unit + 16 e2e. **P4 COMPLETE** — the RuneScape skilling heart is in.

### 2026-06-24 — P4.2 crafting (Smithing + Cooking) + food healing ✅
- Two crafting skills (synced + persisted XP, migration `add_crafting_skills`).
  Recipes are data (smelt bronze/iron, forge bronze sword/helm, cook shrimp/
  trout). Pure `craft()` (4 unit tests). `Craft` is instant + ledgered (inputs
  destroyed, output created); `Consume`/eat removes food and heals (green +N).
  Client crafting panel (toggle C) + click-food-to-eat in the bag; HUD 🔨/🍳.
  98 unit + 16 e2e (new craft.spec: smelt bronze bar + Smithing XP; cook + eat).
  P4 exit met: mine → smith a bronze sword → cook a fish → fight, no drops
  needed. (Deferred: crafting stations, timed/auto-repeat crafts, gathering
  tools — all noted as polish; craft is instant + station-free for v1.)

### 2026-06-19 — P4.1 gathering (Mining + Fishing) ✅
- Two gathering skills with synced+persisted XP (migration
  `add_gathering_skills`). Resource nodes are data-driven, per-player,
  non-depleting placements (no synced schema — client renders from data, server
  validates), like the bank pattern. `Gather` is a zod message; the server runs
  a ~2.4–3s timed gather that auto-repeats while standing still, yields one
  ledgered item per cycle (reason `gather`) + skill XP, and stops on move /
  range / full bag / level gate. Client node markers + HUD ⛏/🎣 levels +
  level-up toasts. 94 unit + 14 e2e (new gather.spec).

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
