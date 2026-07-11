import { ACHIEVEMENTS, type AchievementDef } from "../data/achievements";
import type { SkillId } from "../types";

/**
 * Achievement evaluation (pure). The server builds a snapshot from persisted
 * state and asks which achievements hold; titles are only wearable when their
 * achievement is unlocked.
 */
export interface AchievementSnapshot {
  levels: Record<SkillId, number>;
  /** Quest ids with status "complete". */
  questsCompleted: string[];
}

export function isUnlocked(def: AchievementDef, snap: AchievementSnapshot): boolean {
  switch (def.check.kind) {
    case "level":
      return (snap.levels[def.check.skill] ?? 1) >= def.check.level;
    case "total": {
      const total = Object.values(snap.levels).reduce((n, l) => n + l, 0);
      return total >= def.check.level;
    }
    case "quest":
      return snap.questsCompleted.includes(def.check.questId);
    case "quests_any":
      return snap.questsCompleted.length > 0;
  }
}

/** All unlocked achievement ids for a snapshot. */
export function unlockedAchievements(snap: AchievementSnapshot): string[] {
  return ACHIEVEMENTS.filter((a) => isUnlocked(a, snap)).map((a) => a.id);
}
