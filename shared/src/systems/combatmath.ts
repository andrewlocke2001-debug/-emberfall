/**
 * Stat-based combat resolution (OSRS-flavored): an accuracy roll vs defence,
 * then a damage roll up to a max hit. Pure and deterministic — RNG is injected
 * so it's fully unit-testable and could be seeded per-room for replays.
 */

export interface CombatStats {
  attack: number;
  strength: number;
  defence: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface AttackOutcome {
  /** Whether the accuracy roll landed. */
  hit: boolean;
  /** Damage dealt (0 on a miss). */
  damage: number;
  /** Defender HP after applying damage (clamped at 0). */
  targetHpAfter: number;
  targetDied: boolean;
}

/** A function returning a float in [0, 1). Defaults to Math.random. */
export type Rng = () => number;

/**
 * Probability that an attack lands. OSRS accuracy curve over effective levels
 * (+8 baseline so level 0 isn't hopeless); always strictly between 0 and 1.
 */
export function hitChance(attack: number, defence: number): number {
  const a = Math.max(0, attack) + 8;
  const d = Math.max(0, defence) + 8;
  return a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
}

/** Maximum damage a hit can roll, from the attacker's strength. */
export function maxHit(strength: number): number {
  return Math.floor(Math.max(0, strength) / 4) + 1;
}

/**
 * Resolve a single attack. Consumes up to two RNG draws (accuracy, then
 * damage) so tests can force any outcome. Pure — the caller applies the result.
 */
export function resolveAttack(
  attacker: CombatStats,
  defender: CombatStats,
  rng: Rng = Math.random,
): AttackOutcome {
  if (!attacker.alive || !defender.alive || defender.hp <= 0) {
    return { hit: false, damage: 0, targetHpAfter: defender.hp, targetDied: false };
  }
  const landed = rng() < hitChance(attacker.attack, defender.defence);
  const damage = landed ? Math.floor(rng() * (maxHit(attacker.strength) + 1)) : 0;
  const targetHpAfter = Math.max(0, defender.hp - damage);
  return { hit: landed, damage, targetHpAfter, targetDied: targetHpAfter <= 0 };
}
