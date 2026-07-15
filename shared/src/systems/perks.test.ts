import { describe, it, expect } from "vitest";
import {
  canChoosePerk,
  applyPerkStats,
  perkGcdMs,
  perkLifesteal,
  perkMaxHpBonus,
  executeAdjust,
} from "./perks";
import { PERK_TIERS, perkDef, perkTierIndex, RESPEC_COST } from "../data/perks";

const stats = { attack: 20, strength: 20, defence: 20, hp: 100, maxHp: 100, alive: true };

describe("perk data", () => {
  it("tiers are ordered, unique, and resolvable", () => {
    const seen = new Set<string>();
    let last = 0;
    for (const tier of PERK_TIERS) {
      expect(tier.level).toBeGreaterThan(last);
      last = tier.level;
      for (const c of tier.choices) {
        expect(seen.has(c.id)).toBe(false);
        seen.add(c.id);
        expect(perkDef(c.id)).toEqual(c);
        expect(perkTierIndex(c.id)).toBe(PERK_TIERS.indexOf(tier));
      }
    }
    expect(RESPEC_COST).toBeGreaterThan(0);
  });
});

describe("canChoosePerk", () => {
  it("gates on level and one-choice-per-tier", () => {
    expect(canChoosePerk("berserker", 4, [])).toBe(false); // tier locked
    expect(canChoosePerk("berserker", 5, [])).toBe(true);
    expect(canChoosePerk("guardian", 5, ["berserker"])).toBe(false); // tier spent
    expect(canChoosePerk("berserker", 5, ["berserker"])).toBe(false); // re-pick
    expect(canChoosePerk("quickblade", 14, [])).toBe(false);
    expect(canChoosePerk("quickblade", 15, ["berserker"])).toBe(true);
    expect(canChoosePerk("nonsense", 99, [])).toBe(false);
  });
});

describe("perk application", () => {
  it("berserker/guardian scale the sheet without mutating it", () => {
    const out = applyPerkStats(stats, ["berserker", "guardian"]);
    expect(out.strength).toBe(23);
    expect(out.defence).toBe(23);
    expect(stats.strength).toBe(20);
  });

  it("quickblade shortens the GCD; vampiric heals; juggernaut adds HP", () => {
    expect(perkGcdMs(["quickblade"], 1500)).toBe(1350);
    expect(perkGcdMs([], 1500)).toBe(1500);
    expect(perkLifesteal(["vampiric"])).toBe(2);
    expect(perkLifesteal([])).toBe(0);
    expect(perkMaxHpBonus(["juggernaut"])).toBe(40);
  });

  it("executioner boosts only low-HP targets with real damage", () => {
    expect(executeAdjust(10, 20, 100, ["executioner"])).toBe(13);
    expect(executeAdjust(10, 50, 100, ["executioner"])).toBe(10);
    expect(executeAdjust(10, 20, 100, [])).toBe(10);
    expect(executeAdjust(0, 20, 100, ["executioner"])).toBe(0);
  });
});
