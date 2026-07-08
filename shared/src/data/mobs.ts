/**
 * Mob roster (data-driven, like the kit's content principle). The server reads
 * stats + behavior from here; the client reads name + color for rendering.
 * Tuned around a fresh level-1 player (combat stat ~5, 100 HP).
 *
 * `aggroRadius: 0` marks a passive mob (training dummy) — it never chases or
 * attacks, only takes hits.
 */
import type { DropEntry } from "../systems/loot";

/**
 * A telegraphed area attack (bosses). The boss winds up for `windupMs`,
 * showing a danger circle of `radius` centered where its target stood; when it
 * lands, everyone still inside takes `damage`. Between slams it fights normally
 * and can't start another for `cooldownMs`. Dodgeable by design.
 */
export interface TelegraphDef {
  windupMs: number;
  radius: number;
  damage: number;
  cooldownMs: number;
}

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
  /** Optional telegraphed AoE attack (bosses only). */
  telegraph?: TelegraphDef;
  /** Marks a dungeon boss (bigger nameplate, arena guardian). */
  boss?: boolean;
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

  // --- Tanglewood families (level 20–40, P7) ---
  thorn_stalker: {
    kind: "thorn_stalker",
    name: "Thorn Stalker",
    level: 20,
    attack: 24,
    strength: 26,
    defence: 20,
    maxHp: 140,
    aggroRadius: 170,
    leashRadius: 320,
    attackRange: 40,
    attackCooldownMs: 2000,
    moveSpeed: 165,
    respawnMs: 12000,
    xpReward: 90,
    drops: [
      { itemId: "coins", min: 15, max: 40, chance: 1 },
      { itemId: "iron_ore", min: 1, max: 2, chance: 0.4 },
      { itemId: "health_potion", min: 1, max: 1, chance: 0.15 },
    ],
    color: 0x4e7a3a,
  },
  ruin_sentinel: {
    kind: "ruin_sentinel",
    name: "Ruin Sentinel",
    level: 30,
    attack: 32,
    strength: 34,
    defence: 34,
    maxHp: 240,
    aggroRadius: 140,
    leashRadius: 260,
    attackRange: 48,
    attackCooldownMs: 2600,
    moveSpeed: 110,
    respawnMs: 18000,
    xpReward: 160,
    drops: [
      { itemId: "coins", min: 30, max: 70, chance: 1 },
      { itemId: "iron_bar", min: 1, max: 1, chance: 0.3 },
      { itemId: "ancient_relic", min: 1, max: 1, chance: 0.08 },
    ],
    color: 0x7d8ba1,
  },
  ember_wraith: {
    kind: "ember_wraith",
    name: "Ember Wraith",
    level: 38,
    attack: 42,
    strength: 40,
    defence: 30,
    maxHp: 200,
    aggroRadius: 190,
    leashRadius: 340,
    attackRange: 44,
    attackCooldownMs: 1600,
    moveSpeed: 200,
    respawnMs: 20000,
    xpReward: 220,
    drops: [
      { itemId: "coins", min: 40, max: 90, chance: 1 },
      { itemId: "ancient_relic", min: 1, max: 1, chance: 0.15 },
      { itemId: "health_potion", min: 1, max: 1, chance: 0.3 },
    ],
    color: 0xff9e5e,
  },

  // --- Cinder Depths boss (P7.3) ---
  warden_of_ash: {
    kind: "warden_of_ash",
    name: "Warden of Ash",
    level: 45,
    attack: 48,
    strength: 52,
    defence: 42,
    maxHp: 2400,
    aggroRadius: 420,
    leashRadius: 900,
    attackRange: 56,
    attackCooldownMs: 2400,
    moveSpeed: 120,
    respawnMs: 30000,
    xpReward: 1200,
    drops: [
      { itemId: "coins", min: 400, max: 800, chance: 1 },
      { itemId: "ancient_relic", min: 2, max: 4, chance: 1 },
      { itemId: "cinder_heart", min: 1, max: 1, chance: 0.5 },
    ],
    color: 0xff5a2c,
    boss: true,
    // Slow, heavy, dodgeable: a 1.6s wind-up cinder slam every ~7s.
    telegraph: { windupMs: 1600, radius: 140, damage: 55, cooldownMs: 7000 },
  },
};

export const DEFAULT_MOB_KIND = "dummy";

export function mobDef(kind: string): MobDef {
  return MOBS[kind] ?? MOBS[DEFAULT_MOB_KIND]!;
}
