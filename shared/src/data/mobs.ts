/**
 * Mob roster (data-driven, like the kit's content principle). The server reads
 * stats + behavior from here; the client reads name + color for rendering.
 * Tuned around a fresh level-1 player (combat stat ~5, 100 HP).
 *
 * `aggroRadius: 0` marks a passive mob (training dummy) — it never chases or
 * attacks, only takes hits.
 */
import type { DropEntry } from "../systems/loot";

export interface MobDef {
  kind: string;
  name: string;
  level: number;
  attack: number;
  strength: number;
  defence: number;
  maxHp: number;
  /** World-unit radius at which the mob notices a player. 0 = passive. */
  aggroRadius: number;
  /** If pulled this far from its spawn, the mob disengages and returns home. */
  leashRadius: number;
  /** World-unit reach of the mob's attack. */
  attackRange: number;
  /** Milliseconds between the mob's attacks. */
  attackCooldownMs: number;
  /** Chase speed, world units/second. */
  moveSpeed: number;
  /** Milliseconds before a slain mob respawns. */
  respawnMs: number;
  /** XP awarded for a kill (granted from P2.4). */
  xpReward: number;
  /** Loot table — rolled once per contributor on death (P3.3). */
  drops: DropEntry[];
  /** Client render tint. */
  color: number;
}

export const MOBS: Record<string, MobDef> = {
  dummy: {
    kind: "dummy",
    name: "Training Dummy",
    level: 1,
    attack: 0,
    strength: 0,
    defence: 1,
    maxHp: 200,
    aggroRadius: 0, // passive
    leashRadius: 0,
    attackRange: 0,
    attackCooldownMs: 0,
    moveSpeed: 0,
    respawnMs: 4000,
    xpReward: 4,
    drops: [], // a training dummy drops nothing
    color: 0xb5651d,
  },
  emberling: {
    kind: "emberling",
    name: "Emberling",
    level: 2,
    attack: 4,
    strength: 6,
    defence: 3,
    maxHp: 24,
    aggroRadius: 140,
    leashRadius: 280,
    attackRange: 40,
    attackCooldownMs: 2400,
    moveSpeed: 120,
    respawnMs: 8000,
    xpReward: 12,
    drops: [
      { itemId: "coins", min: 1, max: 8, chance: 1 },
      { itemId: "emberling_fang", min: 1, max: 1, chance: 0.5 },
    ],
    color: 0xff7043,
  },
  wolf: {
    kind: "wolf",
    name: "Ash Wolf",
    level: 4,
    attack: 8,
    strength: 10,
    defence: 6,
    maxHp: 36,
    aggroRadius: 180,
    leashRadius: 340,
    attackRange: 40,
    attackCooldownMs: 1800,
    moveSpeed: 185,
    respawnMs: 10000,
    xpReward: 20,
    drops: [
      { itemId: "coins", min: 3, max: 12, chance: 1 },
      { itemId: "ash_pelt", min: 1, max: 1, chance: 0.6 },
    ],
    color: 0x9e9e9e,
  },
  bandit: {
    kind: "bandit",
    name: "Bandit",
    level: 6,
    attack: 12,
    strength: 16,
    defence: 10,
    maxHp: 60,
    aggroRadius: 160,
    leashRadius: 300,
    attackRange: 44,
    attackCooldownMs: 2400,
    moveSpeed: 130,
    respawnMs: 12000,
    xpReward: 35,
    drops: [
      { itemId: "coins", min: 10, max: 30, chance: 1 },
      { itemId: "health_potion", min: 1, max: 1, chance: 0.25 },
      { itemId: "bronze_sword", min: 1, max: 1, chance: 0.1 },
    ],
    color: 0x8d6e63,
  },
};

export const DEFAULT_MOB_KIND = "dummy";

export function mobDef(kind: string): MobDef {
  return MOBS[kind] ?? MOBS[DEFAULT_MOB_KIND]!;
}
