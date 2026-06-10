import { describe, it, expect } from "vitest";
import { resolveAbility, inRange } from "./combat";
import type { AbilityDef, Combatant } from "../types";

const ability: AbilityDef = {
  id: "strike",
  name: "Strike",
  damage: 12,
  cooldownMs: 600,
  range: 100,
};

function combatant(over: Partial<Combatant> = {}): Combatant {
  return { x: 0, y: 0, hp: 100, maxHp: 100, alive: true, ...over };
}

describe("resolveAbility", () => {
  it("applies damage when the target is in range", () => {
    const r = resolveAbility(combatant(), combatant({ x: 50 }), ability);
    expect(r.ok).toBe(true);
    expect(r.damage).toBe(12);
    expect(r.targetHpAfter).toBe(88);
    expect(r.targetDied).toBe(false);
  });

  it("does not mutate the input combatants", () => {
    const target = combatant({ x: 50 });
    resolveAbility(combatant(), target, ability);
    expect(target.hp).toBe(100); // pure: caller applies the result
  });

  it("fails when the target is out of range", () => {
    const r = resolveAbility(combatant(), combatant({ x: 500 }), ability);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("out_of_range");
    expect(r.targetHpAfter).toBe(100);
  });

  it("clamps HP at 0 and reports death", () => {
    const r = resolveAbility(combatant(), combatant({ x: 10, hp: 8 }), ability);
    expect(r.ok).toBe(true);
    expect(r.targetHpAfter).toBe(0);
    expect(r.targetDied).toBe(true);
  });

  it("a dead attacker cannot act", () => {
    const r = resolveAbility(combatant({ alive: false }), combatant({ x: 10 }), ability);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dead_attacker");
  });

  it("cannot target something already dead", () => {
    const r = resolveAbility(combatant(), combatant({ x: 10, hp: 0, alive: false }), ability);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dead_target");
  });
});

describe("inRange", () => {
  it("is inclusive at the exact range boundary", () => {
    expect(inRange(combatant(), combatant({ x: 100 }), 100)).toBe(true);
    expect(inRange(combatant(), combatant({ x: 101 }), 100)).toBe(false);
  });

  it("measures Euclidean distance on both axes", () => {
    // (30,40) is exactly 50 units away (3-4-5 triangle).
    expect(inRange(combatant(), combatant({ x: 30, y: 40 }), 50)).toBe(true);
    expect(inRange(combatant(), combatant({ x: 30, y: 40 }), 49)).toBe(false);
  });
});
