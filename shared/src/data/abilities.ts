import type { AbilityDef, AbilityId } from "../types";
import { ABILITY_RANGE } from "../types";

/**
 * Data-driven ability table. M0 ships a single ability; adding more is just a
 * new entry here plus a key in the `AbilityId` union.
 */
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  strike: {
    id: "strike",
    name: "Strike",
    damage: 12,
    cooldownMs: 600,
    range: ABILITY_RANGE,
  },
};
