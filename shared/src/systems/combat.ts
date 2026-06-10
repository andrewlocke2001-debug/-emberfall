import type { AbilityDef, Combatant, CombatResult } from "../types";

/** Squared distance — avoids a sqrt when only comparing against a radius. */
export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** True if `target` is within `range` world units of `attacker` (inclusive). */
export function inRange(attacker: Combatant, target: Combatant, range: number): boolean {
  return distSq(attacker.x, attacker.y, target.x, target.y) <= range * range;
}

/**
 * Pure tab-target resolution. Computes the outcome of `attacker` using
 * `ability` on `target` WITHOUT mutating either combatant — the authoritative
 * server applies the result to its synced schema state, and the same function
 * is unit-tested in isolation.
 */
export function resolveAbility(
  attacker: Combatant,
  target: Combatant,
  ability: AbilityDef,
): CombatResult {
  if (!attacker.alive) {
    return miss("dead_attacker", target.hp);
  }
  if (!target.alive || target.hp <= 0) {
    return miss("dead_target", target.hp);
  }
  if (!inRange(attacker, target, ability.range)) {
    return miss("out_of_range", target.hp);
  }

  const damage = ability.damage;
  const targetHpAfter = Math.max(0, target.hp - damage);
  return {
    ok: true,
    damage,
    targetHpAfter,
    targetDied: targetHpAfter <= 0,
  };
}

function miss(reason: NonNullable<CombatResult["reason"]>, currentHp: number): CombatResult {
  return { ok: false, reason, damage: 0, targetHpAfter: currentHp, targetDied: false };
}
