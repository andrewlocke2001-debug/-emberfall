import { BASE_MAX_HP, HP_PER_VITALITY, LEVEL_CAP } from "../types";
import type { CombatStats } from "./combatmath";

/**
 * XP curve + skill→stat derivation. The curve is the classic RuneScape one
 * (gentle early, exponential later), scaled so early levels come quickly.
 * Pure functions — unit-tested and shared by server (authority) and client
 * (level-up feedback).
 */

/** Total XP required to reach `level` (level 1 = 0 XP). Capped at LEVEL_CAP. */
export function xpForLevel(level: number): number {
  const target = Math.max(1, Math.min(LEVEL_CAP, Math.floor(level)));
  let points = 0;
  for (let l = 1; l < target; l++) {
    points += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(points / 4);
}

/** The level a given XP total corresponds to (1..LEVEL_CAP). */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < LEVEL_CAP && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** XP still needed to reach the next level (0 at the cap). */
export function xpToNextLevel(xp: number): number {
  const level = levelForXp(xp);
  if (level >= LEVEL_CAP) return 0;
  return xpForLevel(level + 1) - xp;
}

/** Max HP for a given Vitality level. */
export function maxHpForVitality(vitalityLevel: number): number {
  return BASE_MAX_HP + (Math.max(1, vitalityLevel) - 1) * HP_PER_VITALITY;
}

/**
 * A player's combat stats for resolveAttack. P2.2 derives attack/strength/
 * defence from a single character level; P2.4 will split these out into the
 * Melee/Vitality skills. `hp`/`maxHp` are passed through from live state.
 */
export function combatStatsFromLevel(level: number, hp: number, maxHp: number): CombatStats {
  const s = 4 + Math.max(1, level);
  return { attack: s, strength: s, defence: s, hp, maxHp, alive: hp > 0 };
}
