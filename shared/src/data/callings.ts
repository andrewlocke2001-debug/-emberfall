/**
 * Callings (P13.3 → P15.2) — class identity on the classless chassis
 * (WORLD.md Phase 2). A player chooses ONE Calling; it decides WHERE on the
 * shared passive web (data/web.ts) they enter. Skills stay trainable by
 * anyone; the Calling is how you fight. Numbers are data, never code.
 */

export const CALLING_IDS = [
  "warden",
  "reaver",
  "strider",
  "cinderwright",
  "hearthmender",
  "ashwalker",
] as const;
export type CallingId = (typeof CALLING_IDS)[number];

/** Coins burned to abandon a Calling (clears the whole allocation). */
export const CALLING_RESPEC_COST = 500;

/** What a web node grants — pure numbers, applied by systems/callings.ts. */
export interface TalentEffects {
  /** +% to attack / strength / defence. */
  attackPct?: number;
  strengthPct?: number;
  defencePct?: number;
  /** Flat max-HP. */
  maxHpFlat?: number;
  /** -% global cooldown. */
  gcdPct?: number;
  /** Flat HP restored per landed hit. */
  lifesteal?: number;
  /** +% damage vs targets below 30% HP. */
  executePct?: number;
  /** +% chance a landed hit crits for 1.5×. */
  critChance?: number;
  /** -% ability energy costs. */
  energyCostPct?: number;
  /** +% healing done (Mend etc.). */
  healPowerPct?: number;
}

export interface CallingDef {
  id: CallingId;
  name: string;
  fantasy: string;
}

export const CALLINGS: Record<CallingId, CallingDef> = {
  warden: { id: "warden", name: "Warden", fantasy: "The shield-wall — hold the line, bank the heat." },
  reaver: { id: "reaver", name: "Reaver", fantasy: "The berserker — spend everything, leave nothing standing." },
  strider: { id: "strider", name: "Strider", fantasy: "The ranger — distance is armor, patience is damage." },
  cinderwright: { id: "cinderwright", name: "Cinderwright", fantasy: "The fire mage — draw deep, steward what you kindle." },
  hearthmender: { id: "hearthmender", name: "Hearthmender", fantasy: "The keeper — the hearth-share craft turned outward." },
  ashwalker: { id: "ashwalker", name: "Ashwalker", fantasy: "The knife in the cold — strike where warmth pools." },
};

export function callingDef(id: string): CallingDef | undefined {
  return (CALLINGS as Record<string, CallingDef>)[id];
}
