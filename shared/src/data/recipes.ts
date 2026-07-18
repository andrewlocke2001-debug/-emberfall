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
