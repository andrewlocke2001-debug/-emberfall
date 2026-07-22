import type { AbilityDef, AbilityId } from "../types";
import { ABILITY_RANGE, RANGED_RANGE, RANGED_RANGE_LONG, MAGIC_RANGE } from "../types";

/**
 * Data-driven ability table. P2 ships three: a free basic attack, a stronger
 * energy attack, and an off-GCD self-heal. Adding more is just a new entry
 * here plus a key in the `AbilityId` union.
 */
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  strike: {
    id: "strike",
    name: "Strike",
    kind: "attack",
    damage: 0, // legacy field unused by stat combat
    energyCost: 0,
    cooldownMs: 0, // gated only by the global cooldown
    onGcd: true,
    range: ABILITY_RANGE,
    strengthMul: 1,
  },
  power_strike: {
    id: "power_strike",
    name: "Power Strike",
    kind: "attack",
    damage: 0,
    energyCost: 25,
    cooldownMs: 6000,
    onGcd: true,
    range: ABILITY_RANGE,
    strengthMul: 1.9,
  },
  mend: {
    id: "mend",
    name: "Mend",
    kind: "heal",
    damage: 0,
    energyCost: 35,
    cooldownMs: 12000,
    onGcd: false, // off-GCD utility — weave it between attacks
    range: 0,
    heal: 35,
  },

  // --- Ranged kit (bow required; governed by the Ranged skill) ---
  quick_shot: {
    id: "quick_shot",
    name: "Quick Shot",
    kind: "attack",
    damage: 0,
    energyCost: 0,
    cooldownMs: 0,
    onGcd: true,
    range: RANGED_RANGE,
    strengthMul: 1,
    skill: "ranged",
    weaponTypes: ["bow"],
  },
  aimed_shot: {
    id: "aimed_shot",
    name: "Aimed Shot",
    kind: "attack",
    damage: 0,
    energyCost: 25,
    cooldownMs: 6000,
    onGcd: true,
    range: RANGED_RANGE_LONG,
    strengthMul: 2.0,
    skill: "ranged",
    weaponTypes: ["bow"],
  },

  // --- Axe + dagger specials (melee movesets; the weapon IS the class) ---
  rend: {
    id: "rend",
    name: "Rend",
    kind: "attack",
    damage: 0,
    energyCost: 25,
    cooldownMs: 8000,
    onGcd: true,
    range: ABILITY_RANGE,
    strengthMul: 1.6,
    weaponTypes: ["axe"],
    effect: { kind: "bleed", damage: 9, durationMs: 6000 },
  },
  hamstring: {
    id: "hamstring",
    name: "Hamstring",
    kind: "attack",
    damage: 0,
    energyCost: 20,
    cooldownMs: 8000,
    onGcd: true,
    range: ABILITY_RANGE,
    strengthMul: 1.3,
    weaponTypes: ["dagger"],
    effect: { kind: "slow", moveMult: 0.6, durationMs: 4000 },
  },

  // --- Magic kit (staff required; governed by the Magic skill) ---
  cinderbolt: {
    id: "cinderbolt",
    name: "Cinderbolt",
    kind: "attack",
    damage: 0,
    energyCost: 0,
    cooldownMs: 0,
    onGcd: true,
    range: MAGIC_RANGE,
    strengthMul: 1,
    skill: "magic",
    weaponTypes: ["staff"],
  },
  ember_burst: {
    id: "ember_burst",
    name: "Ember Burst",
    kind: "attack",
    damage: 0,
    energyCost: 30,
    cooldownMs: 8000,
    onGcd: true,
    range: MAGIC_RANGE,
    strengthMul: 2.1,
    skill: "magic",
    weaponTypes: ["staff"],
    effect: { kind: "burn", damage: 12, durationMs: 6000 },
  },

  // --- AOE finishers (P15.4): one per weapon class, hit a whole pack ---
  whirlwind: {
    id: "whirlwind",
    name: "Whirlwind",
    kind: "attack",
    damage: 0,
    energyCost: 35,
    cooldownMs: 10000,
    onGcd: true,
    range: ABILITY_RANGE,
    strengthMul: 1.2,
    aoe: { radius: 96 }, // self-centered — spin through everything around you
  },
  fan_of_knives: {
    id: "fan_of_knives",
    name: "Fan of Knives",
    kind: "attack",
    damage: 0,
    energyCost: 25,
    cooldownMs: 8000,
    onGcd: true,
    range: ABILITY_RANGE,
    strengthMul: 1.0,
    weaponTypes: ["dagger"],
    aoe: { radius: 84 },
  },
  volley: {
    id: "volley",
    name: "Volley",
    kind: "attack",
    damage: 0,
    energyCost: 30,
    cooldownMs: 10000,
    onGcd: true,
    range: RANGED_RANGE,
    strengthMul: 1.1,
    skill: "ranged",
    weaponTypes: ["bow"],
    aoe: { radius: 96, atTarget: true }, // rain arrows on the target's pack
  },
  scorchwave: {
    id: "scorchwave",
    name: "Scorchwave",
    kind: "attack",
    damage: 0,
    energyCost: 40,
    cooldownMs: 12000,
    onGcd: true,
    range: MAGIC_RANGE,
    strengthMul: 1.3,
    skill: "magic",
    weaponTypes: ["staff"],
    aoe: { radius: 104, atTarget: true },
    effect: { kind: "burn", damage: 10, durationMs: 5000 },
  },
};
