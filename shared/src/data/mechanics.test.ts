import { describe, it, expect } from "vitest";
import { MOBS } from "./mobs";

/** Boss mechanics are data — validate their cross-references like all content. */
describe("boss mechanics content", () => {
  it("add waves reference real mob kinds, sane thresholds, sane counts", () => {
    for (const def of Object.values(MOBS)) {
      for (const wave of def.mechanics?.addsAtHpPct ?? []) {
        expect(MOBS[wave.kind], `${def.kind} summons unknown kind ${wave.kind}`).toBeDefined();
        expect(wave.pct).toBeGreaterThan(0);
        expect(wave.pct).toBeLessThan(1);
        expect(wave.count).toBeGreaterThan(0);
        expect(wave.count).toBeLessThanOrEqual(4); // adds support the boss, not replace it
        // Adds must be meaningfully weaker than their summoner.
        expect(MOBS[wave.kind]!.maxHp).toBeLessThan(def.maxHp);
      }
      if (def.mechanics?.enrage) {
        expect(def.mechanics.enrage.cooldownMult).toBeGreaterThan(0);
        expect(def.mechanics.enrage.cooldownMult).toBeLessThanOrEqual(1); // enrage never slows
        expect(def.mechanics.enrage.moveMult).toBeGreaterThanOrEqual(1);
      }
      if (def.mechanics?.onHitEffect) {
        expect(def.mechanics.onHitEffect.kind).not.toBe("slow"); // player slows unsupported
        expect(def.mechanics.onHitEffect.damage ?? 0).toBeGreaterThan(0);
      }
      if (def.mechanics?.telegraphVolley) {
        expect(def.telegraph, `${def.kind} volleys without a telegraph`).toBeDefined();
        expect(def.mechanics.telegraphVolley).toBeGreaterThanOrEqual(2);
        expect(def.mechanics.telegraphVolley).toBeLessThanOrEqual(4);
      }
    }
  });

  it("every boss with a telegraph now fights differently (has mechanics)", () => {
    for (const def of Object.values(MOBS)) {
      if (def.telegraph && def.kind !== "invasion_herald") {
        expect(def.mechanics, `${def.kind} is a telegraph boss with no mechanics`).toBeDefined();
      }
    }
  });
});
