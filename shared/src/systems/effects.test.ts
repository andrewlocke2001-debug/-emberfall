import { describe, it, expect } from "vitest";
import { applyEffect, tickEffects, moveMultOf, type ActiveEffect } from "./effects";
import { ABILITIES } from "../data/abilities";

const T0 = 1_000_000;

describe("applyEffect", () => {
  it("splits total DoT damage into per-second ticks (at least 1 each)", () => {
    const [bleed] = applyEffect([], { kind: "bleed", damage: 9, durationMs: 6000 }, "a", "melee", T0);
    expect(bleed!.perTick).toBe(2); // round(9/6)
    expect(bleed!.endsAt).toBe(T0 + 6000);
    expect(bleed!.moveMult).toBe(1);
  });

  it("same kind from the same source refreshes; other sources stack", () => {
    let list = applyEffect([], { kind: "bleed", damage: 9, durationMs: 6000 }, "a", "melee", T0);
    list = applyEffect(list, { kind: "bleed", damage: 9, durationMs: 6000 }, "a", "melee", T0 + 2000);
    expect(list).toHaveLength(1);
    expect(list[0]!.endsAt).toBe(T0 + 8000);
    list = applyEffect(list, { kind: "bleed", damage: 9, durationMs: 6000 }, "b", "melee", T0 + 2000);
    expect(list).toHaveLength(2);
  });
});

describe("tickEffects", () => {
  it("emits one hit per elapsed second and expires cleanly", () => {
    const list = applyEffect([], { kind: "burn", damage: 12, durationMs: 6000 }, "m", "magic", T0);
    const early = tickEffects(list, T0 + 500);
    expect(early.hits).toHaveLength(0);
    expect(early.remaining).toHaveLength(1);

    const later = tickEffects(early.remaining, T0 + 3100); // seconds 1..3 due
    expect(later.hits).toHaveLength(3);
    expect(later.hits[0]).toEqual({ damage: 2, appliedBy: "m", skill: "magic" });

    const done = tickEffects(later.remaining, T0 + 10_000); // rest + expiry
    expect(done.hits).toHaveLength(3); // seconds 4..6
    expect(done.remaining).toHaveLength(0);
    const total = [...later.hits, ...done.hits].reduce((n, h) => n + h.damage, 0);
    expect(total).toBe(12); // full advertised damage, no more, no less
  });

  it("slows deal no damage but persist until expiry", () => {
    const list = applyEffect([], { kind: "slow", moveMult: 0.6, durationMs: 4000 }, "d", "melee", T0);
    const mid = tickEffects(list, T0 + 2000);
    expect(mid.hits).toHaveLength(0);
    expect(mid.remaining).toHaveLength(1);
    expect(moveMultOf(mid.remaining, T0 + 2000)).toBe(0.6);
    expect(moveMultOf(mid.remaining, T0 + 5000)).toBe(1); // expired
  });
});

describe("ability effect content", () => {
  it("every effect-bearing ability defines a coherent payload", () => {
    for (const a of Object.values(ABILITIES)) {
      if (!a.effect) continue;
      expect(a.effect.durationMs).toBeGreaterThan(0);
      if (a.effect.kind === "slow") expect(a.effect.moveMult).toBeLessThan(1);
      else expect(a.effect.damage ?? 0).toBeGreaterThan(0);
      // Sanity via the pure system: applying it yields a usable ActiveEffect.
      const [e] = applyEffect([], a.effect, "x", a.skill ?? "melee", T0) as [ActiveEffect];
      expect(e.endsAt).toBeGreaterThan(T0);
    }
  });
});
