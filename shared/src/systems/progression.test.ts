import { describe, it, expect } from "vitest";
import { xpForLevel, levelForXp, xpToNextLevel, maxHpForVitality } from "./progression";
import { BASE_MAX_HP, HP_PER_VITALITY, LEVEL_CAP } from "../types";

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
