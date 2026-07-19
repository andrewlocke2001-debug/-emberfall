import { describe, it, expect } from "vitest";
import {
  talentPointsFor,
  pointsSpent,
  canSpendTalent,
  applyTalentStats,
  talentMaxHpBonus,
  talentGcdMs,
  talentLifesteal,
  talentExecuteAdjust,
  talentCritChance,
  talentEnergyCostMul,
  talentHealMul,
} from "./callings";
import { CALLING_IDS, CALLINGS, TALENTS, TALENT_TIER_STEP, talentsOf } from "../data/callings";

const stats = { attack: 50, strength: 50, defence: 50, hp: 100, maxHp: 100, alive: true };

describe("talent content", () => {
  it("every calling has three branches with four tiers and unique node ids", () => {
    const ids = new Set<string>();
    for (const c of CALLING_IDS) {
      const nodes = talentsOf(c);
      expect(nodes.length).toBe(12);
      for (const branch of CALLINGS[c].branches) {
        const tiers = nodes.filter((n) => n.branch === branch).map((n) => n.tier).sort();
        expect(tiers).toEqual([0, 1, 2, 3]);
      }
      for (const n of nodes) {
        expect(ids.has(n.id)).toBe(false);
        ids.add(n.id);
        expect(n.ranks).toBeGreaterThanOrEqual(1);
        expect(Object.keys(n.effects).length).toBeGreaterThan(0);
      }
    }
    expect(TALENTS.length).toBe(72);
  });

  it("a full tree costs more points than the cap grants (choices matter)", () => {
    for (const c of CALLING_IDS) {
      const totalRanks = talentsOf(c).reduce((n, t) => n + t.ranks, 0);
      expect(totalRanks).toBeGreaterThanOrEqual(talentPointsFor(50, 1, 1));
    }
  });
});

describe("talentPointsFor", () => {
  it("is 40% of the highest combat level", () => {
    expect(talentPointsFor(1, 1, 1)).toBe(0);
    expect(talentPointsFor(10, 1, 1)).toBe(4);
    expect(talentPointsFor(3, 40, 2)).toBe(16);
    expect(talentPointsFor(50, 50, 50)).toBe(20);
  });
});

describe("canSpendTalent", () => {
  const t0 = "warden_braced_stance"; // tier 0, 3 ranks
  const t1 = "warden_shield_discipline"; // tier 1 → needs 3 spent
  it("gates on calling, ranks, points, and tier", () => {
    expect(canSpendTalent("warden", {}, t0, 5)).toBe(true);
    expect(canSpendTalent("reaver", {}, t0, 5)).toBe(false); // wrong calling
    expect(canSpendTalent("", {}, t0, 5)).toBe(false); // no calling chosen
    expect(canSpendTalent("warden", { [t0]: 3 }, t0, 9)).toBe(false); // max ranks
    expect(canSpendTalent("warden", {}, t0, 0)).toBe(false); // no points
    expect(canSpendTalent("warden", {}, t1, 9)).toBe(false); // tier locked
    expect(canSpendTalent("warden", { [t0]: TALENT_TIER_STEP }, t1, 9)).toBe(true);
  });
});

describe("talent application", () => {
  it("percentage stats round and stack across nodes", () => {
    // 3 ranks Braced Stance (+12% def) + capstone Living Rampart (+12% def, +20 hp)
    const talents = { warden_braced_stance: 3, warden_living_rampart: 1 };
    const out = applyTalentStats(stats, talents);
    expect(out.defence).toBe(62); // 50 * 1.24
    expect(out.attack).toBe(50); // untouched
    expect(talentMaxHpBonus(talents)).toBe(20);
    expect(stats.defence).toBe(50); // pure — input untouched
  });

  it("gcd, lifesteal, execute, crit, energy, heal knobs all read their fields", () => {
    expect(talentGcdMs({ reaver_frenzy: 2 }, 1500)).toBe(1410); // -6%
    expect(talentLifesteal({ reaver_pain_is_fuel: 3 })).toBe(3);
    expect(talentExecuteAdjust(100, 29, 100, { reaver_scent_of_blood: 3 })).toBe(112);
    expect(talentExecuteAdjust(100, 31, 100, { reaver_scent_of_blood: 3 })).toBe(100);
    expect(talentCritChance({ ashwalker_find_the_gap: 3 })).toBeCloseTo(0.12);
    expect(talentEnergyCostMul({ strider_light_pack: 3 })).toBeCloseTo(0.88);
    expect(talentHealMul({ hearthmender_gentle_coals: 3 })).toBeCloseTo(1.15);
  });

  it("crit chance is capped at 50%", () => {
    // Cross-calling stacking is impossible in game; here it just exercises the clamp.
    const stacked = { ashwalker_find_the_gap: 3, ashwalker_pulse_point: 2, ashwalker_warmth_seeker: 1, ashwalker_the_cold_falling: 1, cinderwright_flashover: 2, cinderwright_emberfall: 1 };
    expect(talentCritChance(stacked)).toBe(0.5);
  });

  it("pointsSpent sums ranks", () => {
    expect(pointsSpent({ a: 3, b: 2 })).toBe(5);
  });
});
