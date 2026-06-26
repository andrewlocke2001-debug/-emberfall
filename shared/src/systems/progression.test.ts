import { describe, it, expect } from "vitest";
import {
  xpForLevel,
  levelForXp,
  xpToNextLevel,
  maxHpForVitality,
  gainXp,
  restedBonus,
  restedAccrual,
} from "./progression";
import { BASE_MAX_HP, HP_PER_VITALITY, LEVEL_CAP, RESTED_MAX, RESTED_PER_HOUR } from "../types";

describe("xpForLevel", () => {
  it("is 0 at level 1 and strictly increasing", () => {
    expect(xpForLevel(1)).toBe(0);
    for (let l = 1; l < LEVEL_CAP; l++) {
      expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    }
  });
});

describe("levelForXp", () => {
  it("inverts xpForLevel at the boundaries", () => {
    for (let l = 1; l <= LEVEL_CAP; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
    }
  });

  it("just-below a threshold is the previous level", () => {
    const threshold = xpForLevel(5);
    expect(levelForXp(threshold - 1)).toBe(4);
    expect(levelForXp(threshold)).toBe(5);
  });

  it("caps at LEVEL_CAP", () => {
    expect(levelForXp(xpForLevel(LEVEL_CAP) * 100)).toBe(LEVEL_CAP);
  });
});

describe("xpToNextLevel", () => {
  it("counts down to the next threshold and is 0 at the cap", () => {
    expect(xpToNextLevel(0)).toBe(xpForLevel(2));
    expect(xpToNextLevel(xpForLevel(LEVEL_CAP))).toBe(0);
  });
});

describe("maxHpForVitality", () => {
  it("is base HP at level 1 and grows per level", () => {
    expect(maxHpForVitality(1)).toBe(BASE_MAX_HP);
    expect(maxHpForVitality(5)).toBe(BASE_MAX_HP + 4 * HP_PER_VITALITY);
  });
});

describe("gainXp", () => {
  it("accumulates XP and reports the resulting level", () => {
    const g = gainXp(0, 10);
    expect(g.xp).toBe(10);
    expect(g.level).toBe(levelForXp(10));
  });

  it("flags a level-up only when the level actually increases", () => {
    // Exactly enough to reach level 2 from scratch → leveled up.
    const justEnough = gainXp(0, xpForLevel(2));
    expect(justEnough.level).toBe(2);
    expect(justEnough.leveledUp).toBe(true);

    // One short of the threshold → no level-up.
    const justShort = gainXp(0, xpForLevel(2) - 1);
    expect(justShort.level).toBe(1);
    expect(justShort.leveledUp).toBe(false);
  });

  it("can cross multiple levels in a single award", () => {
    const g = gainXp(0, xpForLevel(4));
    expect(g.level).toBe(4);
    expect(g.leveledUp).toBe(true);
  });

  it("treats a zero award as a no-op level-wise", () => {
    const start = xpForLevel(3);
    const g = gainXp(start, 0);
    expect(g.xp).toBe(start);
    expect(g.leveledUp).toBe(false);
  });

  it("clamps negative inputs (never loses XP or under/overflows)", () => {
    expect(gainXp(-50, 10).xp).toBe(10); // negative current floored to 0
    expect(gainXp(100, -10).xp).toBe(100); // negative award ignored
  });
});

describe("restedBonus", () => {
  it("is 50% of the award while credit covers it", () => {
    expect(restedBonus(1000, 100)).toBe(50);
  });
  it("is capped by the remaining buffer", () => {
    expect(restedBonus(20, 100)).toBe(20); // only 20 credit left → only 20 bonus
  });
  it("is 0 with no buffer or no award", () => {
    expect(restedBonus(0, 100)).toBe(0);
    expect(restedBonus(1000, 0)).toBe(0);
  });
});

describe("restedAccrual", () => {
  it("banks credit per hour offline", () => {
    expect(restedAccrual(3_600_000, 0)).toBe(RESTED_PER_HOUR); // 1h
    expect(restedAccrual(2 * 3_600_000, 100)).toBe(100 + 2 * RESTED_PER_HOUR);
  });
  it("caps at the maximum and ignores negative time", () => {
    expect(restedAccrual(10_000 * 3_600_000, 0)).toBe(RESTED_MAX);
    expect(restedAccrual(-5000, 200)).toBe(200);
  });
});
