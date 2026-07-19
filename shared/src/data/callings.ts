/**
 * Callings (P13.3) — class identity on the classless chassis (WORLD.md
 * Phase 2). A player chooses ONE Calling; it opens a three-branch talent
 * tree. Skills stay trainable by anyone; the Calling is how you fight.
 * Data-driven like everything else: a node is numbers, never code.
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

/** Coins burned to abandon a Calling (clears all spent talents). */
export const CALLING_RESPEC_COST = 500;

/** Points already spent in the tree required per tier (0,3,6,9). */
export const TALENT_TIER_STEP = 3;

/** What a talent rank grants — pure numbers, applied by systems/callings.ts. */
export interface TalentEffects {
  /** +% to attack / strength / defence per rank. */
  attackPct?: number;
  strengthPct?: number;
  defencePct?: number;
  /** Flat max-HP per rank. */
  maxHpFlat?: number;
  /** -% global cooldown per rank. */
  gcdPct?: number;
  /** Flat HP restored per landed hit, per rank. */
  lifesteal?: number;
  /** +% damage vs targets below 30% HP, per rank. */
  executePct?: number;
  /** +% chance a landed hit crits for 1.5×, per rank. */
  critChance?: number;
  /** -% ability energy costs per rank. */
  energyCostPct?: number;
  /** +% healing done (Mend etc.) per rank. */
  healPowerPct?: number;
}

export interface TalentDef {
  id: string;
  calling: CallingId;
  branch: string;
  name: string;
  desc: string;
  /** Tier gate: requires tier * TALENT_TIER_STEP points already spent. */
  tier: number;
  /** Max ranks. */
  ranks: number;
  effects: TalentEffects;
}

export interface CallingDef {
  id: CallingId;
  name: string;
  fantasy: string;
  branches: [string, string, string];
}

export const CALLINGS: Record<CallingId, CallingDef> = {
  warden: { id: "warden", name: "Warden", fantasy: "The shield-wall — hold the line, bank the heat.", branches: ["Bastion", "Retribution", "Watchfire"] },
  reaver: { id: "reaver", name: "Reaver", fantasy: "The berserker — spend everything, leave nothing standing.", branches: ["Fury", "Carnage", "Bloodfire"] },
  strider: { id: "strider", name: "Strider", fantasy: "The ranger — distance is armor, patience is damage.", branches: ["Marksman", "Fieldcraft", "Windrunner"] },
  cinderwright: { id: "cinderwright", name: "Cinderwright", fantasy: "The fire mage — draw deep, and steward what you kindle.", branches: ["Emberflow", "Ruin", "Ashwork"] },
  hearthmender: { id: "hearthmender", name: "Hearthmender", fantasy: "The keeper — the hearth-share craft turned outward.", branches: ["Warmth", "Share", "Vigil"] },
  ashwalker: { id: "ashwalker", name: "Ashwalker", fantasy: "The knife in the cold — strike where warmth pools.", branches: ["Cold Read", "Veil", "Opportunist"] },
};

/** Compact node builder — data stays data; this only saves keystrokes. */
function node(
  calling: CallingId,
  branch: string,
  tier: number,
  ranks: number,
  name: string,
  desc: string,
  effects: TalentEffects,
): TalentDef {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return { id: `${calling}_${slug}`, calling, branch, name, desc, tier, ranks, effects };
}

export const TALENTS: TalentDef[] = [
  // ── Warden — tank: defence, HP, retaliation ───────────────────────────────
  node("warden", "Bastion", 0, 3, "Braced Stance", "+4% defence per rank.", { defencePct: 4 }),
  node("warden", "Bastion", 1, 2, "Shield Discipline", "+6% defence per rank.", { defencePct: 6 }),
  node("warden", "Bastion", 2, 2, "Stonewall", "+10 max HP per rank.", { maxHpFlat: 10 }),
  node("warden", "Bastion", 3, 1, "Living Rampart", "+12% defence and +20 max HP.", { defencePct: 12, maxHpFlat: 20 }),
  node("warden", "Retribution", 0, 3, "Answered Blow", "+3% strength per rank.", { strengthPct: 3 }),
  node("warden", "Retribution", 1, 2, "Thorned Guard", "Landed hits restore 1 HP per rank.", { lifesteal: 1 }),
  node("warden", "Retribution", 2, 2, "Warden's Wrath", "+5% strength per rank.", { strengthPct: 5 }),
  node("warden", "Retribution", 3, 1, "The Line Holds", "+8% strength, +8% defence.", { strengthPct: 8, defencePct: 8 }),
  node("warden", "Watchfire", 0, 3, "Banked Vigor", "+8 max HP per rank.", { maxHpFlat: 8 }),
  node("warden", "Watchfire", 1, 2, "Hearth-Fed", "+4% healing done per rank.", { healPowerPct: 4 }),
  node("warden", "Watchfire", 2, 2, "Steadfast", "+4% attack per rank.", { attackPct: 4 }),
  node("warden", "Watchfire", 3, 1, "Beacon of the Vale", "+30 max HP.", { maxHpFlat: 30 }),

  // ── Reaver — berserker: strength, execution, speed ────────────────────────
  node("reaver", "Fury", 0, 3, "Sharpened Rage", "+4% strength per rank.", { strengthPct: 4 }),
  node("reaver", "Fury", 1, 2, "Reckless Swing", "+6% strength per rank.", { strengthPct: 6 }),
  node("reaver", "Fury", 2, 2, "Frenzy", "-3% global cooldown per rank.", { gcdPct: 3 }),
  node("reaver", "Fury", 3, 1, "Red Mist", "+10% strength, -4% global cooldown.", { strengthPct: 10, gcdPct: 4 }),
  node("reaver", "Carnage", 0, 3, "Scent of Blood", "+4% damage vs wounded (<30% HP) per rank.", { executePct: 4 }),
  node("reaver", "Carnage", 1, 2, "Butcher", "+6% execute damage per rank.", { executePct: 6 }),
  node("reaver", "Carnage", 2, 2, "No Escape", "+4% attack per rank.", { attackPct: 4 }),
  node("reaver", "Carnage", 3, 1, "Executioner's Due", "+15% execute damage.", { executePct: 15 }),
  node("reaver", "Bloodfire", 0, 3, "Pain is Fuel", "Landed hits restore 1 HP per rank.", { lifesteal: 1 }),
  node("reaver", "Bloodfire", 1, 2, "Burning Sinew", "+8 max HP per rank.", { maxHpFlat: 8 }),
  node("reaver", "Bloodfire", 2, 2, "Overdraw", "-5% ability energy costs per rank.", { energyCostPct: 5 }),
  node("reaver", "Bloodfire", 3, 1, "The Long Burn", "Landed hits restore 3 HP.", { lifesteal: 3 }),

  // ── Strider — ranger: accuracy, crits, efficiency ─────────────────────────
  node("strider", "Marksman", 0, 3, "Dead Eye", "+4% attack per rank.", { attackPct: 4 }),
  node("strider", "Marksman", 1, 2, "Broadheads", "+5% strength per rank.", { strengthPct: 5 }),
  node("strider", "Marksman", 2, 2, "Called Shot", "+4% crit chance per rank.", { critChance: 4 }),
  node("strider", "Marksman", 3, 1, "One Loosed Breath", "+10% attack, +6% crit chance.", { attackPct: 10, critChance: 6 }),
  node("strider", "Fieldcraft", 0, 3, "Light Pack", "-4% ability energy costs per rank.", { energyCostPct: 4 }),
  node("strider", "Fieldcraft", 1, 2, "Forager's Vigor", "+8 max HP per rank.", { maxHpFlat: 8 }),
  node("strider", "Fieldcraft", 2, 2, "Camouflage", "+5% defence per rank.", { defencePct: 5 }),
  node("strider", "Fieldcraft", 3, 1, "Trail Provision", "-10% ability energy costs.", { energyCostPct: 10 }),
  node("strider", "Windrunner", 0, 3, "Quick Nock", "-2% global cooldown per rank.", { gcdPct: 2 }),
  node("strider", "Windrunner", 1, 2, "Skirmisher", "+4% attack per rank.", { attackPct: 4 }),
  node("strider", "Windrunner", 2, 2, "Wind's Favor", "+3% crit chance per rank.", { critChance: 3 }),
  node("strider", "Windrunner", 3, 1, "Never Rooted", "-6% global cooldown.", { gcdPct: 6 }),

  // ── Cinderwright — fire mage: power, crits, deep draws ────────────────────
  node("cinderwright", "Emberflow", 0, 3, "Kindled Focus", "+4% strength (spellpower) per rank.", { strengthPct: 4 }),
  node("cinderwright", "Emberflow", 1, 2, "Drawn Deep", "-4% ability energy costs per rank.", { energyCostPct: 4 }),
  node("cinderwright", "Emberflow", 2, 2, "Roaring Channel", "+6% strength per rank.", { strengthPct: 6 }),
  node("cinderwright", "Emberflow", 3, 1, "The Second Lamp", "+12% strength, -6% energy costs.", { strengthPct: 12, energyCostPct: 6 }),
  node("cinderwright", "Ruin", 0, 3, "Searing Precision", "+4% attack per rank.", { attackPct: 4 }),
  node("cinderwright", "Ruin", 1, 2, "Flashover", "+4% crit chance per rank.", { critChance: 4 }),
  node("cinderwright", "Ruin", 2, 2, "Cinder Storm", "+5% execute damage per rank.", { executePct: 5 }),
  node("cinderwright", "Ruin", 3, 1, "Emberfall", "+10% crit chance.", { critChance: 10 }),
  node("cinderwright", "Ashwork", 0, 3, "Warm Robes", "+6 max HP per rank.", { maxHpFlat: 6 }),
  node("cinderwright", "Ashwork", 1, 2, "Ash Shield", "+5% defence per rank.", { defencePct: 5 }),
  node("cinderwright", "Ashwork", 2, 2, "Self-Steward", "+4% healing done per rank.", { healPowerPct: 4 }),
  node("cinderwright", "Ashwork", 3, 1, "Tender's Insurance", "+20 max HP, +6% defence.", { maxHpFlat: 20, defencePct: 6 }),

  // ── Hearthmender — keeper: healing, endurance, generosity ─────────────────
  node("hearthmender", "Warmth", 0, 3, "Gentle Coals", "+5% healing done per rank.", { healPowerPct: 5 }),
  node("hearthmender", "Warmth", 1, 2, "Fed Flame", "+7% healing done per rank.", { healPowerPct: 7 }),
  node("hearthmender", "Warmth", 2, 2, "Second Helping", "-5% ability energy costs per rank.", { energyCostPct: 5 }),
  node("hearthmender", "Warmth", 3, 1, "The Open Door", "+15% healing done.", { healPowerPct: 15 }),
  node("hearthmender", "Share", 0, 3, "Thick Blood", "+8 max HP per rank.", { maxHpFlat: 8 }),
  node("hearthmender", "Share", 1, 2, "Given Freely", "+4% defence per rank.", { defencePct: 4 }),
  node("hearthmender", "Share", 2, 2, "Kept Promise", "Landed hits restore 1 HP per rank.", { lifesteal: 1 }),
  node("hearthmender", "Share", 3, 1, "Hearth-Share", "+25 max HP, +5% healing done.", { maxHpFlat: 25, healPowerPct: 5 }),
  node("hearthmender", "Vigil", 0, 3, "Watchful", "+3% attack per rank.", { attackPct: 3 }),
  node("hearthmender", "Vigil", 1, 2, "Firm Hand", "+4% strength per rank.", { strengthPct: 4 }),
  node("hearthmender", "Vigil", 2, 2, "Long Night", "-2% global cooldown per rank.", { gcdPct: 2 }),
  node("hearthmender", "Vigil", 3, 1, "Dawn Comes", "+8% attack, +8% strength.", { attackPct: 8, strengthPct: 8 }),

  // ── Ashwalker — rogue: crits, speed, opportunism ──────────────────────────
  node("ashwalker", "Cold Read", 0, 3, "Find the Gap", "+4% crit chance per rank.", { critChance: 4 }),
  node("ashwalker", "Cold Read", 1, 2, "Pulse Point", "+5% crit chance per rank.", { critChance: 5 }),
  node("ashwalker", "Cold Read", 2, 2, "Anatomist", "+5% execute damage per rank.", { executePct: 5 }),
  node("ashwalker", "Cold Read", 3, 1, "Warmth-Seeker", "+12% crit chance.", { critChance: 12 }),
  node("ashwalker", "Veil", 0, 3, "Soft Step", "+4% defence per rank.", { defencePct: 4 }),
  node("ashwalker", "Veil", 1, 2, "Grey Cloak", "-4% ability energy costs per rank.", { energyCostPct: 4 }),
  node("ashwalker", "Veil", 2, 2, "Ash Veil", "+6% defence per rank.", { defencePct: 6 }),
  node("ashwalker", "Veil", 3, 1, "Unseen Departure", "-8% energy costs, +6% defence.", { energyCostPct: 8, defencePct: 6 }),
  node("ashwalker", "Opportunist", 0, 3, "Quick Hands", "-2% global cooldown per rank.", { gcdPct: 2 }),
  node("ashwalker", "Opportunist", 1, 2, "Twist the Knife", "+5% strength per rank.", { strengthPct: 5 }),
  node("ashwalker", "Opportunist", 2, 2, "Low Blow", "+4% attack per rank.", { attackPct: 4 }),
  node("ashwalker", "Opportunist", 3, 1, "The Cold Falling", "+8% strength, +6% crit chance.", { strengthPct: 8, critChance: 6 }),
];

const BY_ID = new Map(TALENTS.map((t) => [t.id, t]));

export function talentDef(id: string): TalentDef | undefined {
  return BY_ID.get(id);
}

export function callingDef(id: string): CallingDef | undefined {
  return (CALLINGS as Record<string, CallingDef>)[id];
}

export function talentsOf(calling: CallingId): TalentDef[] {
  return TALENTS.filter((t) => t.calling === calling);
}
