import type { AbilityDef, AbilityId } from "../types";
import { ABILITY_RANGE } from "../types";

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
};
