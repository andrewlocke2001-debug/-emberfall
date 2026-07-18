/**
 * Domain types & tuning constants shared across client and server.
 *
 * This module is intentionally PURE: no Colyseus, no Phaser, no Node imports.
 * Anything here can run in the browser, on the server, or under Vitest.
 */

export type Vec2 = { x: number; y: number };

export type ClassId = "Warrior" | "Ranger" | "Mage";

/**
 * All ability ids, as a const tuple so the zod message schema
 * (`z.enum(ABILITY_IDS)`) and the `AbilityId` union can never drift.
 */
export const ABILITY_IDS = [
  "strike",
  "power_strike",
  "mend",
  "quick_shot",
  "aimed_shot",
  "cinderbolt",
  "ember_burst",
  "rend",
  "hamstring",
] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];

/**
 * Weapon classes (P13). A weapon's class decides which combat skill governs
 * it (see systems/weapons.ts) and which abilities it can use. Movesets per
 * class deepen in P13.2; P13.1 ships bows (Ranged) and staves (Magic) with
 * their basic kits, plus axes/daggers as melee stat-spreads.
 */
export const WEAPON_TYPES = ["sword", "axe", "maul", "dagger", "bow", "staff"] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

/** Server simulation tick rate (Hz) and the derived fixed step. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/**
 * The zone is a simple rectangular play area for M0. World units == pixels,
 * so the client can render server coordinates 1:1.
 */
export const ZONE_WIDTH = 1600;
export const ZONE_HEIGHT = 1200;

/** Player movement speed, in world units per second. */
export const MOVE_SPEED = 220;

/** Mount (P11): speed multiplier while riding, and its one-time coin cost. */
export const MOUNT_SPEED_MULT = 1.6;
export const MOUNT_COST = 500;

/** Fast-travel (P11): flat coin fee per waystone jump (a sink). */
export const FAST_TRAVEL_COST = 30;

/** Death penalty: every equipped piece loses this much durability (a repair
 *  bill — dying should sting without deleting progress). */
export const DEATH_DURABILITY_LOSS = 15;

/** Default tab-target ability range, in world units. */
export const ABILITY_RANGE = 150;

/** Ranged/magic reach (P13): bows outrange staves outrange melee. */
export const RANGED_RANGE = 320;
export const RANGED_RANGE_LONG = 360; // Aimed Shot's extra reach
export const MAGIC_RANGE = 280;

/** Global cooldown shared by core abilities (FFXIV-style deliberate pacing). */
export const GCD_MS = 1500;

/** Energy resource: pool size + passive regen (per second). */
export const BASE_MAX_ENERGY = 100;
export const ENERGY_REGEN_PER_SEC = 12;

/** Hit points for a fresh level-1 character (M0 ships a single archetype). */
export const BASE_MAX_HP = 100;

/**
 * Launch skills. Melee drives attack/damage; Vitality, HP; Mining/Fishing
 * gather; Smithing/Cooking craft (smelt/forge gear, cook food).
 */
export const SKILL_IDS = [
  "melee",
  "ranged",
  "magic",
  "vitality",
  "mining",
  "fishing",
  "smithing",
  "cooking",
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/** Combat skills that can govern an attack (a weapon class picks one). */
export type CombatSkill = "melee" | "ranged" | "magic";

/** How close (world units) a player must be to a resource node to gather it. */
export const GATHER_RANGE = 64;

/** How close (world units) a player must be to an NPC / vendor to interact. */
export const TALK_RANGE = 80;

/** Fraction of an item's value a vendor pays when buying it from a player. */
export const VENDOR_BUYBACK_RATE = 0.4;
/** Vendors lowball equipment (kills the craft-and-dump coin printer). */
export const GEAR_BUYBACK_RATE = 0.15;
/** Flat accuracy granted to PLAYER attacks only — mobs keep the raw curve.
 * The OSRS curve alone lands ~48% at even stats, which at a 1.5s GCD reads
 * as "my attacks don't register" (direct play-test feedback). */
export const PLAYER_ACCURACY_BONUS = 0.3;

/** Coins to fully repair a piece of gear, as a fraction of its value. Repairing
 *  is a gold sink; a full-value item costs this fraction of its value to mend. */
export const REPAIR_COST_RATE = 0.35;

/** PvP (Ashreach): max melee-level gap allowed between attacker and target. */
export const PVP_LEVEL_BAND = 15;
/** How long a PvP aggressor stays skulled (shown to everyone). */
export const SKULL_MS = 5 * 60_000;
/** Spawn protection in a PvP zone (broken early by attacking). */
export const SPAWN_PROTECT_MS = 10_000;
/** Items dropped on death in a PvP zone (most valuable units) + all coins. */
export const PVP_DEATH_DROPS = 3;

/** Exchange (order-book market) tax on the seller's proceeds — a coin sink. */
export const EXCHANGE_TAX_RATE = 0.02;
/** Max open exchange orders per player. */
export const EXCHANGE_MAX_ORDERS = 8;

/** Maximum entries in a player's friends list. */
export const FRIENDS_MAX = 50;

/** Maximum players in a party. */
export const PARTY_MAX = 5;

/** Raid (P12): the Molten Throne admits up to 8 (two parties can share). */
export const RAID_MAX_PLAYERS = 8;

/** Battleground (P12.2): structured team PvP. First team to the score wins. */
export const BG_ZONE = "bg_arena";
export const BG_SCORE_TO_WIN = 3;
/** Coins paid to each winner (a faucet — ledgered). */
export const BG_REWARD_COINS = 150;
/** Max melee-level gap for a party member to share kill XP. */
export const PARTY_LEVEL_RANGE = 10;

/** Level cap for P2 (GW-style low ceiling; raised in later content). */
export const LEVEL_CAP = 50;

/** Rested XP (WoW-style): logged-off time banks a buffer that adds +50% XP. */
export const RESTED_BONUS_RATE = 0.5;
/** Rested XP credit accrued per hour spent offline. */
export const RESTED_PER_HOUR = 500;
/** Maximum rested XP credit a character can bank. */
export const RESTED_MAX = 10_000;

/** Extra max HP granted per Vitality level above 1. */
export const HP_PER_VITALITY = 8;

/** Inventory capacity — RuneScape's 28 slots. */
export const INVENTORY_SLOTS = 28;

/** Bank capacity — generous town storage, separate from the carried bag. */
export const BANK_SLOTS = 240;
/** How close (world units) a player must be to a town bank to use it. */
export const BANK_RANGE = 120;

/** How close (world units) a player must be to pick up ground loot. */
export const PICKUP_RANGE = 56;
/** Ground loot is reserved for its owner this long (ms) before going public. */
export const LOOT_OWNERSHIP_MS = 60_000;
/** Ground loot despawns this long (ms) after it drops. */
export const LOOT_DESPAWN_MS = 120_000;

/**
 * One stack of items in an inventory: a content id (see @mmo/shared/data/items)
 * + a quantity. The shared inventory system enforces per-item stack limits and
 * the 28-slot cap; the server is authoritative and the only writer.
 */
export interface ItemStack {
  itemId: string;
  qty: number;
}

/** Static definition of an ability. Data-driven so adding more stays cheap. */
export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** Legacy flat damage (M0 resolveAbility); P2 stat combat ignores it. */
  damage: number;
  /** Per-ability cooldown in milliseconds, enforced server-side. */
  cooldownMs: number;
  /** Maximum range in world units. */
  range: number;
  // --- P2 fields (optional → existing literals/tests stay valid) ---
  /** "attack" resolves vs the target's defence; "heal" restores the caster. */
  kind?: "attack" | "heal";
  /** Energy spent on use. */
  energyCost?: number;
  /** Whether using it triggers and is blocked by the global cooldown. */
  onGcd?: boolean;
  /** attack: multiplier on the caster's strength for the max hit. */
  strengthMul?: number;
  /** heal: HP restored to the caster. */
  heal?: number;
  // --- P13 fields ---
  /** Governing combat skill for stats + XP. Defaults to "melee". */
  skill?: CombatSkill;
  /** Weapon classes that can use it. Undefined = any melee weapon or unarmed. */
  weaponTypes?: WeaponType[];
  /** Status effect applied to the target on a LANDED hit (P13.2). */
  effect?: AbilityEffect;
}

/** A status effect carried by an ability (data) — see systems/effects.ts. */
export interface AbilityEffect {
  kind: "bleed" | "burn" | "slow";
  /** Total damage over the duration (DoTs tick once per second). */
  damage?: number;
  /** Movement-speed multiplier while active (slows; 0.6 = 40% slower). */
  moveMult?: number;
  durationMs: number;
}

/**
 * The minimal combatant shape the pure combat system operates on. The server
 * builds one of these from its schema state; tests build plain objects.
 */
export interface Combatant {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

/** Outcome of resolving a single ability use. Pure data — no mutation. */
export interface CombatResult {
  ok: boolean;
  reason?: "out_of_range" | "dead_attacker" | "dead_target";
  /** Damage that would be dealt (0 when `ok` is false). */
  damage: number;
  /** Target HP after applying damage, clamped at 0. */
  targetHpAfter: number;
  /** Whether this hit reduced the target to 0 HP. */
  targetDied: boolean;
}
