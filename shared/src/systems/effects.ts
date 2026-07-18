import type { AbilityEffect, CombatSkill } from "../types";

/**
 * Status effects (P13.2, pure). Abilities can leave a bleed/burn (damage over
 * time, ticking once per second) or a slow (movement multiplier) on a landed
 * hit. Rooms keep one ActiveEffect[] per entity and call tickEffects each
 * sim step; DoT hits carry who applied them and with which skill, so kill
 * credit and XP routing stay exact even when the victim dies to the dot.
 */

/** DoTs tick on this cadence. */
export const EFFECT_TICK_MS = 1000;

export interface ActiveEffect {
  kind: AbilityEffect["kind"];
  /** Who applied it (session id / entity id) — kill credit for DoT deaths. */
  appliedBy: string;
  /** The combat skill the applying ability used — XP routing for DoT kills. */
  skill: CombatSkill;
  endsAt: number;
  /** Next DoT tick due at (meaningless for slows). */
  nextTickAt: number;
  /** Damage dealt per tick (0 for slows). */
  perTick: number;
  /** Movement multiplier while active (1 for non-slows). */
  moveMult: number;
}

/** One DoT tick's outcome. */
export interface EffectHit {
  damage: number;
  appliedBy: string;
  skill: CombatSkill;
}

/**
 * Apply an ability's effect to a target's list. The same kind from the same
 * source REFRESHES (no self-stacking); different sources stack.
 */
export function applyEffect(
  list: ActiveEffect[],
  effect: AbilityEffect,
  appliedBy: string,
  skill: CombatSkill,
  now: number,
): ActiveEffect[] {
  const ticks = Math.max(1, Math.floor(effect.durationMs / EFFECT_TICK_MS));
  const next: ActiveEffect = {
    kind: effect.kind,
    appliedBy,
    skill,
    endsAt: now + effect.durationMs,
    nextTickAt: now + EFFECT_TICK_MS,
    perTick: effect.damage ? Math.max(1, Math.round(effect.damage / ticks)) : 0,
    moveMult: effect.moveMult ?? 1,
  };
  return [...list.filter((e) => !(e.kind === next.kind && e.appliedBy === appliedBy)), next];
}

/**
 * Advance a target's effects to `now`: collect due DoT hits, drop expired
 * entries. Pure — the room applies the damage and keeps `remaining`.
 */
export function tickEffects(
  list: ActiveEffect[],
  now: number,
): { hits: EffectHit[]; remaining: ActiveEffect[] } {
  const hits: EffectHit[] = [];
  const remaining: ActiveEffect[] = [];
  for (const e of list) {
    let nextTickAt = e.nextTickAt;
    while (e.perTick > 0 && nextTickAt <= now && nextTickAt <= e.endsAt) {
      hits.push({ damage: e.perTick, appliedBy: e.appliedBy, skill: e.skill });
      nextTickAt += EFFECT_TICK_MS;
    }
    if (e.endsAt > now) remaining.push(nextTickAt === e.nextTickAt ? e : { ...e, nextTickAt });
  }
  return { hits, remaining };
}

/** The strongest (lowest) movement multiplier among unexpired slows. */
export function moveMultOf(list: ActiveEffect[], now: number): number {
  let mult = 1;
  for (const e of list) if (e.endsAt > now && e.moveMult < mult) mult = e.moveMult;
  return mult;
}
