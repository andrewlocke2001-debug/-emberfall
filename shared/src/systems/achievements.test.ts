import { describe, it, expect } from "vitest";
import { unlockedAchievements, type AchievementSnapshot } from "./achievements";

const snap = (over: Partial<AchievementSnapshot> = {}): AchievementSnapshot => ({
  levels: { melee: 1, ranged: 1, magic: 1, vitality: 1, mining: 1, fishing: 1, smithing: 1, cooking: 1 },
  questsCompleted: [],
  ...over,
});

describe("unlockedAchievements", () => {
  it("starts with nothing unlocked", () => {
    expect(unlockedAchievements(snap())).toEqual([]);
  });

  it("unlocks level, total, and quest milestones", () => {
    const s = snap({
      levels: { melee: 10, ranged: 1, magic: 1, vitality: 9, mining: 10, fishing: 8, smithing: 7, cooking: 6 },
      questsCompleted: ["greet_mira", "the_ember_scar"],
    });
    expect(unlockedAchievements(s).sort()).toEqual(
      ["first_quest", "ember_scar", "melee_10", "mining_10", "total_50"].sort(),
    );
  });
});
