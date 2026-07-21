import type { CombatStats } from "./combatmath";
import type { CallingId, TalentEffects } from "../data/callings";
import { WEB_STARTS, WEB_ADJACENCY, webNode } from "../data/web";

/**
 * Passive-web allocation (P15.2, pure). A player's allocation is a plain
 * `Record<nodeId, 1>` — every web node is rank 1 (the build is the SHAPE of
 * what you allocate). Reachability is adjacency: a node is allocatable if it
 * is adjacent to a node you already own, seeded by your Calling's gate.
 * Validated + applied here, persisted as JSON; rooms wire the effects to the
 * exact same combat seams the perk trunk uses. Field/function names are kept
 * from the P13.3 tree so no netcode or persistence changed.
 */

export type Talents = Record<string, number>;

/** Passive points earned: 40% of your highest combat skill level (as before). */
export function talentPointsFor(meleeLvl: number, rangedLvl: number, magicLvl: number): number {
  return Math.floor((Math.max(meleeLvl, rangedLvl, magicLvl) * 2) / 5);
}

/** Nodes allocated. Each web node is one point; the Calling gate is free. */
export function pointsSpent(talents: Talents): number {
  let n = 0;
  for (const id of Object.keys(talents)) if (webNode(id)) n++;
  return n;
}

/** Drop any allocated id that isn't a real web node (migration / safety). */
export function pruneToWeb(talents: Talents): Talents {
  const out: Talents = {};
  for (const id of Object.keys(talents)) if (webNode(id)) out[id] = 1;
  return out;
}

/** The set of nodes that count as owned for reachability (adds the free gate). */
function ownedSet(calling: CallingId | "", talents: Talents): Set<string> {
  const owned = new Set<string>();
  for (const id of Object.keys(talents)) if (webNode(id)) owned.add(id);
  if (calling && WEB_STARTS[calling as CallingId]) owned.add(WEB_STARTS[calling as CallingId]);
  return owned;
}

/** Is `nodeId` reachable — the gate, or adjacent to an already-owned node? */
export function isReachable(calling: CallingId | "", talents: Talents, nodeId: string): boolean {
  if (!webNode(nodeId)) return false;
  const owned = ownedSet(calling, talents);
  if (owned.has(nodeId)) return false; // already allocated (gate counts as owned)
  return (WEB_ADJACENCY[nodeId] ?? []).some((n) => owned.has(n));
}

/**
 * May `talentId` be allocated? Requires a Calling, a spare point, and web
 * reachability. (Signature kept from P13.3 so callsites don't change.)
 */
export function canSpendTalent(
  calling: CallingId | "",
  talents: Talents,
  talentId: string,
  availablePoints: number,
): boolean {
  if (!calling) return false;
  if (pointsSpent(talents) >= availablePoints) return false;
  return isReachable(calling, talents, talentId);
}

/** Sum an effect field across all allocated web nodes. */
function total(talents: Talents, field: keyof TalentEffects): number {
  let sum = 0;
  for (const id of Object.keys(talents)) {
    const per = webNode(id)?.effects[field];
    if (per) sum += per;
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
