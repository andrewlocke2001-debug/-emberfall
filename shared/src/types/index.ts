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
export const ABILITY_IDS = ["strike"] as const;
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

/** Hit points for a fresh level-1 character (M0 ships a single archetype). */
export const BASE_MAX_HP = 100;

/** Static definition of an ability. Data-driven so M1 can add more cheaply. */
export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** Flat base damage before any future scaling. */
  damage: number;
  /** Cooldown in milliseconds, enforced server-side. */
  cooldownMs: number;
  /** Maximum range in world units. */
  range: number;
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
