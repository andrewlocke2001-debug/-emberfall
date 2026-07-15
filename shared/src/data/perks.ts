/**
 * The Melee skill tree (play-test ask; WoW-classic-style talents). Three
 * tiers unlock at Melee 5 / 15 / 30; each tier is a permanent CHOICE of one
 * of two identities — until you pay the respec fee (a gold sink). Data-driven
 * like everything else: adding a tier or perk never touches combat code.
 */
export interface PerkDef {
  id: string;
  name: string;
  desc: string;
}

export interface PerkTier {
  /** Melee level that unlocks this tier. */
  level: number;
  choices: [PerkDef, PerkDef];
}

export const PERK_TIERS: PerkTier[] = [
  {
    level: 5,
    choices: [
      { id: "berserker", name: "Berserker", desc: "+15% Strength — hit harder, always." },
      { id: "guardian", name: "Guardian", desc: "+15% Defence — take fewer, weaker hits." },
    ],
  },
  {
    level: 15,
    choices: [
      { id: "quickblade", name: "Quickblade", desc: "Global cooldown reduced by 10%." },
      { id: "vampiric", name: "Vampiric", desc: "Heal 2 HP every time a strike lands." },
    ],
  },
  {
    level: 30,
    choices: [
      { id: "executioner", name: "Executioner", desc: "+30% damage to targets below 30% HP." },
      { id: "juggernaut", name: "Juggernaut", desc: "+40 max HP." },
    ],
  },
];

/** Coins burned to clear all perk choices (a sink; choices are meaningful). */
export const RESPEC_COST = 200;

export function perkDef(id: string): PerkDef | undefined {
  for (const tier of PERK_TIERS) {
    const hit = tier.choices.find((c) => c.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** The tier a perk belongs to, or -1. */
export function perkTierIndex(id: string): number {
  return PERK_TIERS.findIndex((t) => t.choices.some((c) => c.id === id));
}
