import { PERK_TIERS, perkTierIndex } from "../data/perks";
import type { CombatStats } from "./combatmath";

/**
 * Perk rules + combat application (pure). The room stores the chosen perk ids
 * and calls these at the exact seams combat already flows through — perks
 * never fork the combat code, they only adjust its numbers.
 */

/** May this perk be chosen right now? (tier unlocked, tier not yet spent) */
export function canChoosePerk(perkId: string, meleeLevel: number, chosen: string[]): boolean {
  const tierIdx = perkTierIndex(perkId);
  if (tierIdx < 0) return false;
  const tier = PERK_TIERS[tierIdx]!;
  if (meleeLevel < tier.level) return false;
  // One choice per tier — picking again (or the sibling) requires a respec.
  return !tier.choices.some((c) => chosen.includes(c.id));
}

/** Stat-sheet adjustments (Berserker/Guardian). Returns a NEW stats object. */
export function applyPerkStats(stats: CombatStats, chosen: string[]): CombatStats {
  const out = { ...stats };
  if (chosen.includes("berserker")) out.strength = Math.round(out.strength * 1.15);
  if (chosen.includes("guardian")) out.defence = Math.round(out.defence * 1.15);
  return out;
}

/** Quickblade: the global cooldown shortens by 10%. */
export function perkGcdMs(chosen: string[], baseMs: number): number {
  return chosen.includes("quickblade") ? Math.round(baseMs * 0.9) : baseMs;
}

/** Vampiric: HP restored per landed strike. */
export function perkLifesteal(chosen: string[]): number {
  return chosen.includes("vampiric") ? 2 : 0;
}

/** Juggernaut: flat max-HP bonus. */
export function perkMaxHpBonus(chosen: string[]): number {
  return chosen.includes("juggernaut") ? 40 : 0;
}

/** Executioner: boost damage vs targets below 30% HP. Returns adjusted dmg. */
export function executeAdjust(
  damage: number,
  targetHp: number,
  targetMaxHp: number,
  chosen: string[],
): number {
  if (damage <= 0 || !chosen.includes("executioner")) return damage;
  if (targetMaxHp <= 0 || targetHp / targetMaxHp >= 0.3) return damage;
  return Math.round(damage * 1.3);
}
