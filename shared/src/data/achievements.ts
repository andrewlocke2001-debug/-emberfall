import type { SkillId } from "../types";

/**
 * Achievements (P10.2) — data-driven milestones computed from persisted state
 * (skill levels + completed quests). Some carry a title the player can wear.
 */
export type AchievementCheck =
  | { kind: "level"; skill: SkillId; level: number }
  | { kind: "total"; level: number }
  | { kind: "quest"; questId: string }
  | { kind: "quests_any" };

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** Wearable title unlocked with this achievement (shown after the name). */
  title?: string;
  check: AchievementCheck;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_quest",
    name: "First Steps",
    desc: "Complete any quest.",
    title: "the Initiate",
    check: { kind: "quests_any" },
  },
  {
    id: "ember_scar",
    name: "Into the Scar",
    desc: "Complete The Ember Scar.",
    title: "Emberborn",
    check: { kind: "quest", questId: "the_ember_scar" },
  },
  {
    id: "melee_10",
    name: "Blooded",
    desc: "Reach Melee level 10.",
    title: "the Warrior",
    check: { kind: "level", skill: "melee", level: 10 },
  },
  {
    id: "melee_40",
    name: "Blademaster",
    desc: "Reach Melee level 40.",
    title: "Blademaster",
    check: { kind: "level", skill: "melee", level: 40 },
  },
  {
    id: "mining_10",
    name: "Prospector",
    desc: "Reach Mining level 10.",
    title: "the Prospector",
    check: { kind: "level", skill: "mining", level: 10 },
  },
  {
    id: "total_50",
    name: "Seasoned",
    desc: "Reach total level 50.",
    title: "the Seasoned",
    check: { kind: "total", level: 50 },
  },
];

export function achievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
