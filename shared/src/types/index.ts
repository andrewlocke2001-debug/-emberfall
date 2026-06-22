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
export const ABILITY_IDS = ["strike", "power_strike", "mend"] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];

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

/** Default tab-target ability range, in world units. */
export const ABILITY_RANGE = 150;

/** Global cooldown shared by core abilities (FFXIV-style deliberate pacing). */
export const GCD_MS = 1500;

/** Energy resource: pool size + passive regen (per second). */
export const BASE_MAX_ENERGY = 100;
export const ENERGY_REGEN_PER_SEC = 12;

/** Hit points for a fresh level-1 character (M0 ships a single archetype). */
export const BASE_MAX_HP = 100;

/** P2 skills (more arrive post-P2). Melee drives attack/damage; Vitality, HP. */
export const SKILL_IDS = ["melee", "vitality"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/** Level cap for P2 (GW-style low ceiling; raised in later content). */
export const LEVEL_CAP = 50;

/** Extra max HP granted per Vitality level above 1. */
export const HP_PER_VITALITY = 8;

/** Inventory capacity — RuneScape's 28 slots. */
export const INVENTORY_SLOTS = 28;

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
