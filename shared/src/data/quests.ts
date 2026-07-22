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
  // The Marrowgate Downs arc (P14.1) — the League's quarantine line.
  the_quarantine_line: {
    id: "the_quarantine_line",
    name: "The Quarantine Line",
    summary: "Put down 5 Unreturned Wanderers in the Marrowgate Downs.",
    objectives: [
      { type: "kill", mob: "unreturned_wanderer", count: 5, desc: "Put down 5 Unreturned Wanderers" },
    ],
    rewards: { coins: 60, xp: [{ skill: "melee", amount: 120 }] },
    giver: "quartermaster_hale",
  },
  the_barred_door: {
    id: "the_barred_door",
    name: "The Barred Door",
    summary: "Descend the opened barrow and put the Gatewright to rest.",
    objectives: [{ type: "kill", mob: "gatewright", count: 1, desc: "Slay the Gatewright in the Refused Column" }],
    rewards: { coins: 120, xp: [{ skill: "melee", amount: 200 }] },
    requires: "wax_for_the_wardens",
    giver: "quartermaster_hale",
  },
  wax_for_the_wardens: {
    id: "wax_for_the_wardens",
    name: "Wax for the Wardens",
    summary: "Gather 6 Grave Wax from the Unreturned for Quartermaster Hale.",
    objectives: [{ type: "collect", itemId: "grave_wax", count: 6, desc: "Gather 6 Grave Wax" }],
    rewards: { coins: 45, items: [{ itemId: "health_potion", qty: 2 }, { itemId: "leather_boots", qty: 1 }], xp: [{ skill: "vitality", amount: 80 }] },
    requires: "the_quarantine_line",
    giver: "quartermaster_hale",
  },
  // The Vossmere arc (P14.3) — the Shoremade charter.
  planks_over_water: {
    id: "planks_over_water",
    name: "Planks Over Water",
    summary: "Cull 6 Quenchclaw Crabs before they chew through the stilt-city's pilings.",
    objectives: [{ type: "kill", mob: "quenchclaw", count: 6, desc: "Cull 6 Quenchclaw Crabs" }],
    rewards: { coins: 70, xp: [{ skill: "melee", amount: 150 }] },
    giver: "charterwright_essa",
  },
  the_wake_paid: {
    id: "the_wake_paid",
    name: "The Wake, Paid",
    summary: "Gather 8 Sea Wrack for the anchorage's Wake-Paying rites.",
    objectives: [{ type: "collect", itemId: "sea_wrack", count: 8, desc: "Gather 8 Sea Wrack" }],
    rewards: { coins: 60, items: [{ itemId: "dressed_crab", qty: 2 }, { itemId: "leather_gloves", qty: 1 }], xp: [{ skill: "cooking", amount: 100 }] },
    requires: "planks_over_water",
    giver: "charterwright_essa",
  },
  // The Dolmholt arc (P14.4) — the Rite-keepers vs the Open-Vein.
  the_unlawful_cut: {
    id: "the_unlawful_cut",
    name: "The Unlawful Cut",
    summary: "Drive 6 Open-Vein Cutters off the pithead they never asked to dig.",
    objectives: [{ type: "kill", mob: "open_vein_cutter", count: 6, desc: "Drive off 6 Open-Vein Cutters" }],
    rewards: { coins: 90, xp: [{ skill: "melee", amount: 220 }] },
    giver: "rite_keeper_brunna",
  },
  ore_for_the_asking: {
    id: "ore_for_the_asking",
    name: "Ore for the Asking",
    summary: "Mine 10 Iron Ore the proper way — with the asking done — for the hold.",
    objectives: [{ type: "collect", itemId: "iron_ore", count: 10, desc: "Bring 10 Iron Ore" }],
    rewards: { coins: 80, items: [{ itemId: "iron_gauntlets", qty: 1 }], xp: [{ skill: "mining", amount: 200 }] },
    requires: "the_unlawful_cut",
    giver: "rite_keeper_brunna",
  },
  // The Cinderfen arc (P14.5) — the tending against the harvest.
  the_fen_bleeds: {
    id: "the_fen_bleeds",
    name: "The Fen Bleeds",
    summary: "Put down 6 Fen Creepers — kindling without a steward, boiling out of the wound.",
    objectives: [{ type: "kill", mob: "fen_creeper", count: 6, desc: "Put down 6 Fen Creepers" }],
    rewards: { coins: 110, xp: [{ skill: "melee", amount: 260 }] },
    giver: "tender_ilse",
  },
  amber_for_the_tending: {
    id: "amber_for_the_tending",
    name: "Amber for the Tending",
    summary: "Gather 6 Fen Amber — the tenders burn it back into the ground at night.",
    objectives: [{ type: "collect", itemId: "fen_amber", count: 6, desc: "Gather 6 Fen Amber" }],
    rewards: { coins: 100, items: [{ itemId: "health_potion", qty: 2 }, { itemId: "iron_boots", qty: 1 }], xp: [{ skill: "vitality", amount: 150 }] },
    requires: "the_fen_bleeds",
    giver: "tender_ilse",
  },
  // The Graywastes arc (P16.1) — the cache expeditions vs the cold.
  the_cold_ledger: {
    id: "the_cold_ledger",
    name: "The Cold Ledger",
    summary: "Put down 6 Cache-Reavers robbing the Order's expeditions.",
    objectives: [{ type: "kill", mob: "cache_reaver", count: 6, desc: "Put down 6 Cache-Reavers" }],
    rewards: { coins: 130, xp: [{ skill: "melee", amount: 320 }] },
    giver: "cache_factor_merrin",
  },
  what_the_beacon_gathers: {
    id: "what_the_beacon_gathers",
    name: "What the Beacon Gathers",
    summary: "Gather 8 Grave Wax from the wights the black lamp keeps calling in.",
    objectives: [{ type: "collect", itemId: "grave_wax", count: 8, desc: "Gather 8 Grave Wax" }],
    rewards: { coins: 120, items: [{ itemId: "health_potion", qty: 3 }], xp: [{ skill: "vitality", amount: 220 }] },
    requires: "the_cold_ledger",
    giver: "cache_factor_merrin",
  },
  // The Kindlecourt arc (P16.2) — cataloguing a capital that fights back.
  the_dead_watch: {
    id: "the_dead_watch",
    name: "The Dead Watch",
    summary: "Put down 6 Court Sentinels still patrolling a fallen capital.",
    objectives: [{ type: "kill", mob: "court_sentinel", count: 6, desc: "Put down 6 Court Sentinels" }],
    rewards: { coins: 150, xp: [{ skill: "melee", amount: 380 }] },
    giver: "docent_havel",
  },
  glass_for_the_study: {
    id: "glass_for_the_study",
    name: "Glass for the Study",
    summary: "Gather 8 Lamp Glass for Havel's catalogue of the melted lamps.",
    objectives: [{ type: "collect", itemId: "lamp_glass", count: 8, desc: "Gather 8 Lamp Glass" }],
    rewards: { coins: 140, items: [{ itemId: "health_potion", qty: 3 }], xp: [{ skill: "magic", amount: 300 }] },
    requires: "the_dead_watch",
    giver: "docent_havel",
  },
  // First contact — meet the Hearthwarden who runs the gate.
  greet_mira: {
    id: "greet_mira",
    name: "A Warden's Welcome",
    summary: "Speak with Warden Mira in Meadowbrook.",
    objectives: [{ type: "talk", npcId: "hearthwarden_mira", desc: "Talk to Warden Mira" }],
    rewards: { coins: 10 },
    giver: "hearthwarden_mira",
  },
  // Tutorial gather quest — proves the gather→turn-in loop with no combat.
  miners_welcome: {
    id: "miners_welcome",
    name: "A Miner's Welcome",
    summary: "Bring 3 Copper Ore to the Hearthwardens.",
    objectives: [{ type: "collect", itemId: "copper_ore", count: 3, desc: "Mine 3 Copper Ore" }],
    rewards: { coins: 25, xp: [{ skill: "mining", amount: 40 }] },
    giver: "hearthwarden_mira",
  },
  // First combat quest — cull the wilds.
  thin_the_pack: {
    id: "thin_the_pack",
    name: "Thin the Pack",
    summary: "Slay 3 Ash Wolves in Greenreach.",
    objectives: [{ type: "kill", mob: "wolf", count: 3, desc: "Kill 3 Ash Wolves" }],
    rewards: { coins: 40, xp: [{ skill: "melee", amount: 60 }] },
    requires: "miners_welcome",
    giver: "hearthwarden_mira",
  },
  // Teaches the fishing → cooking loop.
  supper_for_the_inn: {
    id: "supper_for_the_inn",
    name: "Supper for the Inn",
    summary: "Cook 3 Shrimp for the Meadowbrook inn.",
    objectives: [{ type: "collect", itemId: "shrimp", count: 3, desc: "Cook 3 Shrimp" }],
    rewards: { coins: 25, xp: [{ skill: "cooking", amount: 40 }] },
    requires: "greet_mira",
    giver: "hearthwarden_mira",
  },
  // Spotlight-lite: a small combine quest gating a real reward.
  forge_proven: {
    id: "forge_proven",
    name: "Proven at the Forge",
    summary: "Smith a Bronze Sword and bring it back.",
    objectives: [{ type: "collect", itemId: "bronze_sword", count: 1, desc: "Smith a Bronze Sword" }],
    rewards: { coins: 40, items: [{ itemId: "iron_ore", qty: 3 }], xp: [{ skill: "smithing", amount: 50 }] },
    requires: "miners_welcome",
    giver: "smith_dorin",
  },
  // Spotlight capstone — pulls the arc together with a contested-wilds hunt and
  // a Fine-tier reward (the iron sword). (Richer set-piece mechanics — choices,
  // puzzles — are a later content pass; the framework supports the objectives.)
  the_ember_scar: {
    id: "the_ember_scar",
    name: "The Ember Scar",
    summary: "Drive a Bandit from the Greenreach scar and bring back 2 Ash Pelts.",
    objectives: [
      { type: "kill", mob: "bandit", count: 1, desc: "Defeat a Bandit" },
      { type: "collect", itemId: "ash_pelt", count: 2, desc: "Collect 2 Ash Pelts" },
    ],
    rewards: { coins: 60, items: [{ itemId: "iron_sword", qty: 1 }], xp: [{ skill: "melee", amount: 150 }] },
    requires: "thin_the_pack",
    giver: "hearthwarden_mira",
  },
};

export function questDef(id: string): QuestDef | undefined {
  return QUESTS[id];
}

export const QUEST_IDS = Object.keys(QUESTS);
