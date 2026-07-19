import type { CombatStats } from "./combatmath";
import { TALENT_TIER_STEP, talentDef, type CallingId, type TalentEffects } from "../data/callings";

/**
 * Calling talents (P13.3, pure). A player's spent talents are a plain
 * `Record<talentId, ranks>` — validated here, applied here, persisted as
 * JSON. Rooms wire these to the same combat seams the perk trunk uses.
 */

/** Talent points earned: 40% of your highest combat skill level — a full
 * tree costs 24 ranks, so even at cap (20 pts) you choose what to master. */
export function talentPointsFor(meleeLvl: number, rangedLvl: number, magicLvl: number): number {
  return Math.floor((Math.max(meleeLvl, rangedLvl, magicLvl) * 2) / 5);
}

export type Talents = Record<string, number>;

export function pointsSpent(talents: Talents): number {
  return Object.values(talents).reduce((n, r) => n + r, 0);
}

/**
 * May one more rank of `talentId` be bought? Checks: node belongs to the
 * player's calling, rank room left, a point is available, and the tier is
 * unlocked (tier * TALENT_TIER_STEP points already spent).
 */
export function canSpendTalent(
  calling: CallingId | "",
  talents: Talents,
  talentId: string,
  availablePoints: number,
): boolean {
  const def = talentDef(talentId);
  if (!def || def.calling !== calling) return false;
  if ((talents[talentId] ?? 0) >= def.ranks) return false;
  const spent = pointsSpent(talents);
  if (spent >= availablePoints) return false;
  return spent >= def.tier * TALENT_TIER_STEP;
}

/** Sum an effect field across all spent ranks. */
function total(talents: Talents, field: keyof TalentEffects): number {
  let sum = 0;
  for (const [id, ranks] of Object.entries(talents)) {
    const def = talentDef(id);
    const per = def?.effects[field];
    if (def && per) sum += per * Math.min(ranks, def.ranks);
  }
  return sum;
}

/** Percentage attack/strength/defence bonuses onto a finished stat sheet. */
export function applyTalentStats(stats: CombatStats, talents: Talents): CombatStats {
  const out = { ...stats };
  out.attack = Math.round(out.attack * (1 + total(talents, "attackPct") / 100));
  out.strength = Math.round(out.strength * (1 + total(talents, "strengthPct") / 100));
  out.defence = Math.round(out.defence * (1 + total(talents, "defencePct") / 100));
  return out;
}

export function talentMaxHpBonus(talents: Talents): number {
  return total(talents, "maxHpFlat");
}

export function talentGcdMs(talents: Talents, baseMs: number): number {
  return Math.round(baseMs * (1 - total(talents, "gcdPct") / 100));
}

export function talentLifesteal(talents: Talents): number {
  return total(talents, "lifesteal");
}

/** Damage multiplier vs targets below 30% HP (stacks onto the perk execute). */
export function talentExecuteAdjust(damage: number, targetHp: number, targetMaxHp: number, talents: Talents): number {
  const pct = total(talents, "executePct");
  if (pct <= 0 || targetMaxHp <= 0 || targetHp / targetMaxHp >= 0.3) return damage;
  return Math.round(damage * (1 + pct / 100));
}

/** Chance in [0,1] that a landed hit crits for CRIT_MULT. */
export function talentCritChance(talents: Talents): number {
  return Math.min(0.5, total(talents, "critChance") / 100);
}
export const CRIT_MULT = 1.5;

/** Multiplier on ability energy costs (floored at half price). */
export function talentEnergyCostMul(talents: Talents): number {
  return Math.max(0.5, 1 - total(talents, "energyCostPct") / 100);
}

/** Multiplier on healing done. */
export function talentHealMul(talents: Talents): number {
  return 1 + total(talents, "healPowerPct") / 100;
}
