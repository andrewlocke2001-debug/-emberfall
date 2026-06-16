import { describe, it, expect } from "vitest";
import { hitChance, maxHit, resolveAttack, type CombatStats } from "./combatmath";

function stats(over: Partial<CombatStats> = {}): CombatStats {
  return { attack: 10, strength: 10, defence: 10, hp: 50, maxHp: 50, alive: true, ...over };
}

/** A scripted RNG that returns each provided value in turn (then 0). */
function scriptedRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}

describe("hitChance", () => {
  it("stays strictly within (0, 1)", () => {
    for (const [a, d] of [
      [0, 0],
      [1, 99],
      [99, 1],
      [50, 50],
    ] as const) {
      const c = hitChance(a, d);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(1);
    }
  });

  it("rises with attack and falls with defence", () => {
    expect(hitChance(50, 10)).toBeGreaterThan(hitChance(10, 10));
    expect(hitChance(10, 50)).toBeLessThan(hitChance(10, 10));
  });
});

describe("maxHit", () => {
  it("scales with strength", () => {
    expect(maxHit(0)).toBe(1);
    expect(maxHit(40)).toBe(11);
    expect(maxHit(80)).toBeGreaterThan(maxHit(40));
  });
});

describe("resolveAttack", () => {
  it("misses when the accuracy roll fails (no damage)", () => {
    const r = resolveAttack(stats(), stats(), scriptedRng(0.999));
    expect(r.hit).toBe(false);
    expect(r.damage).toBe(0);
    expect(r.targetHpAfter).toBe(50);
  });

  it("hits and deals damage up to max hit", () => {
    // accuracy roll 0 (always lands), damage roll 0.999 → near max hit.
    const r = resolveAttack(stats({ strength: 40 }), stats(), scriptedRng(0, 0.999));
    expect(r.hit).toBe(true);
    expect(r.damage).toBeGreaterThan(0);
    expect(r.damage).toBeLessThanOrEqual(maxHit(40));
    expect(r.targetHpAfter).toBe(50 - r.damage);
  });

  it("clamps HP at 0 and reports death", () => {
    const r = resolveAttack(stats({ strength: 999 }), stats({ hp: 2 }), scriptedRng(0, 0.999));
    expect(r.targetHpAfter).toBe(0);
    expect(r.targetDied).toBe(true);
  });

  it("a dead attacker or dead target does nothing", () => {
    expect(resolveAttack(stats({ alive: false }), stats(), scriptedRng(0, 0)).hit).toBe(false);
    expect(resolveAttack(stats(), stats({ alive: false }), scriptedRng(0, 0)).hit).toBe(false);
  });
});
