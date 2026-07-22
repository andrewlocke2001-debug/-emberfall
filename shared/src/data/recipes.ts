import type { SkillId, ItemStack } from "../types";

/**
 * Crafting recipes (Smithing smelt/forge, Cooking). Data-driven like items and
 * mobs — adding a recipe is a one-line edit, never a crafting-code change. The
 * server consumes the inputs and produces the output (both ledgered); a recipe
 * gates on a minimum skill level.
 */
export interface RecipeDef {
  id: string;
  skill: Extract<SkillId, "smithing" | "cooking">;
  name: string;
  /** Items consumed per craft. */
  inputs: ItemStack[];
  /** Item produced per craft. */
  output: ItemStack;
  /** Skill XP per craft. */
  xp: number;
  /** Minimum skill level to craft. */
  levelReq: number;
}

export const RECIPES: Record<string, RecipeDef> = {
  // --- Smithing: smelt ore into bars, then forge bars into gear ---
  smelt_bronze: {
    id: "smelt_bronze",
    skill: "smithing",
    name: "Bronze Bar",
    inputs: [
      { itemId: "copper_ore", qty: 1 },
      { itemId: "tin_ore", qty: 1 },
    ],
    output: { itemId: "bronze_bar", qty: 1 },
    xp: 6,
    levelReq: 1,
  },
  smelt_iron: {
    id: "smelt_iron",
    skill: "smithing",
    name: "Iron Bar",
    inputs: [{ itemId: "iron_ore", qty: 1 }],
    output: { itemId: "iron_bar", qty: 1 },
    xp: 12,
    levelReq: 10,
  },
  forge_bronze_sword: {
    id: "forge_bronze_sword",
    skill: "smithing",
    name: "Bronze Sword",
    inputs: [{ itemId: "bronze_bar", qty: 1 }],
    output: { itemId: "bronze_sword", qty: 1 },
    xp: 12,
    levelReq: 1,
  },
  forge_bronze_helm: {
    id: "forge_bronze_helm",
    skill: "smithing",
    name: "Bronze Helm",
    inputs: [{ itemId: "bronze_bar", qty: 1 }],
    output: { itemId: "bronze_helm", qty: 1 },
    xp: 8,
    levelReq: 1,
  },
  forge_bronze_dagger: {
    id: "forge_bronze_dagger",
    skill: "smithing",
    name: "Bronze Dagger",
    inputs: [{ itemId: "bronze_bar", qty: 1 }],
    output: { itemId: "bronze_dagger", qty: 1 },
    xp: 10,
    levelReq: 1,
  },
  forge_bronze_axe: {
    id: "forge_bronze_axe",
    skill: "smithing",
    name: "Bronze Axe",
    inputs: [{ itemId: "bronze_bar", qty: 1 }],
    output: { itemId: "bronze_axe", qty: 1 },
    xp: 12,
    levelReq: 2,
  },
  forge_iron_dagger: {
    id: "forge_iron_dagger",
    skill: "smithing",
    name: "Iron Dagger",
    inputs: [{ itemId: "iron_bar", qty: 1 }],
    output: { itemId: "iron_dagger", qty: 1 },
    xp: 16,
    levelReq: 12,
  },
  forge_iron_axe: {
    id: "forge_iron_axe",
    skill: "smithing",
    name: "Iron Axe",
    inputs: [{ itemId: "iron_bar", qty: 2 }],
    output: { itemId: "iron_axe", qty: 1 },
    xp: 22,
    levelReq: 14,
  },

  // --- Cooking: raw fish into food ---
  cook_shrimp: {
    id: "cook_shrimp",
    skill: "cooking",
    name: "Shrimp",
    inputs: [{ itemId: "raw_shrimp", qty: 1 }],
    output: { itemId: "shrimp", qty: 1 },
    xp: 6,
    levelReq: 1,
  },
  forge_iron_helm: {
    id: "forge_iron_helm", skill: "smithing", name: "Iron Helm",
    inputs: [{ itemId: "iron_bar", qty: 2 }], output: { itemId: "iron_helm", qty: 1 }, xp: 24, levelReq: 13,
  },
  forge_iron_platebody: {
    id: "forge_iron_platebody", skill: "smithing", name: "Iron Platebody",
    inputs: [{ itemId: "iron_bar", qty: 5 }], output: { itemId: "iron_platebody", qty: 1 }, xp: 60, levelReq: 20,
  },
  forge_iron_legs: {
    id: "forge_iron_legs", skill: "smithing", name: "Iron Legs",
    inputs: [{ itemId: "iron_bar", qty: 3 }], output: { itemId: "iron_legs", qty: 1 }, xp: 36, levelReq: 16,
  },
  forge_iron_gauntlets: {
    id: "forge_iron_gauntlets", skill: "smithing", name: "Iron Gauntlets",
    inputs: [{ itemId: "iron_bar", qty: 2 }], output: { itemId: "iron_gauntlets", qty: 1 }, xp: 22, levelReq: 13,
  },
  forge_iron_boots: {
    id: "forge_iron_boots", skill: "smithing", name: "Iron Boots",
    inputs: [{ itemId: "iron_bar", qty: 2 }], output: { itemId: "iron_boots", qty: 1 }, xp: 22, levelReq: 14,
  },
  forge_bronze_maul: {
    id: "forge_bronze_maul", skill: "smithing", name: "Bronze Maul",
    inputs: [{ itemId: "bronze_bar", qty: 2 }], output: { itemId: "bronze_maul", qty: 1 }, xp: 14, levelReq: 4,
  },
  forge_iron_maul: {
    id: "forge_iron_maul", skill: "smithing", name: "Iron Maul",
    inputs: [{ itemId: "iron_bar", qty: 3 }], output: { itemId: "iron_maul", qty: 1 }, xp: 28, levelReq: 16,
  },
  cook_crab: {
    id: "cook_crab",
    skill: "cooking",
    name: "Dressed Crab",
    inputs: [{ itemId: "crab_meat", qty: 1 }],
    output: { itemId: "dressed_crab", qty: 1 },
    xp: 20,
    levelReq: 15,
  },
  cook_trout: {
    id: "cook_trout",
    skill: "cooking",
    name: "Trout",
    inputs: [{ itemId: "raw_trout", qty: 1 }],
    output: { itemId: "trout", qty: 1 },
    xp: 16,
    levelReq: 15,
  },
};

export function recipeDef(id: string): RecipeDef | undefined {
  return RECIPES[id];
}

export const RECIPE_IDS = Object.keys(RECIPES);
