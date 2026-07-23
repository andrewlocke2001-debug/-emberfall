import type { BossMechanics } from "../data/mobs";

/**
 * Boss-fight primitive math (P20.1) — pure helpers behind the new
 * BossMechanics fields (phase escalation, charge rushes, ground hazards).
 * Rooms interpret the mechanics; the numbers are computed here so both
 * engines (server ZoneRoom + solo localRoom) agree exactly.
 */

export interface PhaseMods {
  /** True once the boss has fallen past the phase threshold. */
  active: boolean;
  windupMult: number;
  radiusMult: number;
  damageMult: number;
  moveMult: number;
}

const NO_PHASE: PhaseMods = { active: false, windupMult: 1, radiusMult: 1, damageMult: 1, moveMult: 1 };

/** The phase escalation in force at this HP (identity mods above threshold). */
export function phaseMods(mech: BossMechanics | undefined, hp: number, maxHp: number): PhaseMods {
  const p = mech?.phase;
  if (!p || maxHp <= 0 || hp > maxHp * p.pct) return NO_PHASE;
  return {
    active: true,
    windupMult: p.windupMult ?? 1,
    radiusMult: p.radiusMult ?? 1,
    damageMult: p.damageMult ?? 1,
    moveMult: p.moveMult ?? 1,
  };
}

export interface HazardLike {
  x: number;
  y: number;
  radius: number;
  dps: number;
  until: number;
}

/** Summed damage-per-second of every live pool covering the point. */
export function hazardDpsAt(hazards: Iterable<HazardLike>, x: number, y: number, now: number): number {
  let dps = 0;
  for (const h of hazards) {
    if (now >= h.until) continue;
    const dx = x - h.x;
    const dy = y - h.y;
    if (dx * dx + dy * dy <= h.radius * h.radius) dps += h.dps;
  }
  return dps;
}

/** One straight-line step of a charge rush; `arrived` when the target is reached. */
export function chargeStep(
  x: number,
  y: number,
  tx: number,
  ty: number,
  speed: number,
  dt: number,
): { x: number; y: number; arrived: boolean } {
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;
  if (dist <= step || dist === 0) return { x: tx, y: ty, arrived: true };
  return { x: x + (dx / dist) * step, y: y + (dy / dist) * step, arrived: false };
}

/** Is the point within `width` of the charging body's center? */
export function inChargePath(bx: number, by: number, px: number, py: number, width: number): boolean {
  const dx = px - bx;
  const dy = py - by;
  return dx * dx + dy * dy <= width * width;
}
