import type { ItemStack, SkillId } from "../types";

/**
 * Quests as data (kit rule #4). Objectives are a small discriminated union;
 * adding a quest is a data edit, never a quest-engine change. Progress + state
 * live per-player (see systems/quests); the server is authoritative.
 *
 * P5.1 wires `kill` and `collect`; `talk` is defined now and wired to NPCs in
 * P5.2.
 */
export type QuestObjective =
  | { type: "kill"; mob: string; count: number; desc: string }
  | { type: "collect"; itemId: string; count: number; desc: string }
  | { type: "talk"; npcId: string; desc: string };

export interface QuestRewards {
  coins?: number;
  items?: ItemStack[];
  xp?: { skill: SkillId; amount: number }[];
}

export interface QuestDef {
  id: string;
  name: string;
  /** One-line pitch shown in the log / by the giver. */
  summary: string;
  objectives: QuestObjective[];
  rewards: QuestRewards;
  /** Quest id that must be complete first (for chains). */
  requires?: string;
  /** NPC who gives + turns in this quest (wired in P5.2). */
  giver?: string;
}

export const QUESTS: Record<string, QuestDef> = {
  // Tutorial gather quest — proves the gather→turn-in loop with no combat.
  miners_welcome: {
    id: "miners_welcome",
    name: "A Miner's Welcome",
    summary: "Bring 3 Copper Ore to the Hearthwardens.",
    objectives: [{ type: "collect", itemId: "copper_ore", count: 3, desc: "Mine 3 Copper Ore" }],
    rewards: { coins: 50, xp: [{ skill: "mining", amount: 40 }] },
    giver: "hearthwarden_mira",
  },
  // First combat quest — cull the wilds.
  thin_the_pack: {
    id: "thin_the_pack",
    name: "Thin the Pack",
    summary: "Slay 3 Ash Wolves in Greenreach.",
    objectives: [{ type: "kill", mob: "wolf", count: 3, desc: "Kill 3 Ash Wolves" }],
    rewards: { coins: 80, xp: [{ skill: "melee", amount: 60 }] },
    requires: "miners_welcome",
    giver: "hearthwarden_mira",
  },
  // Spotlight-lite: a small combine quest gating a real reward.
  forge_proven: {
    id: "forge_proven",
    name: "Proven at the Forge",
    summary: "Smith a Bronze Sword and bring it back.",
    objectives: [{ type: "collect", itemId: "bronze_sword", count: 1, desc: "Smith a Bronze Sword" }],
    rewards: { coins: 60, items: [{ itemId: "iron_ore", qty: 3 }], xp: [{ skill: "smithing", amount: 50 }] },
    requires: "miners_welcome",
    giver: "smith_dorin",
  },
};

export function questDef(id: string): QuestDef | undefined {
  return QUESTS[id];
}

export const QUEST_IDS = Object.keys(QUESTS);
