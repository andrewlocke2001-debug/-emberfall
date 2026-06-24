import { describe, it, expect } from "vitest";
import { craft, canCraft } from "./crafting";
import type { Inventory } from "./inventory";
import type { RecipeDef } from "../data/recipes";
import type { ItemDef } from "../data/items";

const bronze: RecipeDef = {
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
};

const lookup = (id: string): ItemDef | undefined =>
  ({ id, name: id, rarity: "common", maxStack: 1_000_000, value: 1 }) as ItemDef;

describe("canCraft", () => {
  it("is true only when every input is present in sufficient quantity", () => {
    expect(
      canCraft([{ itemId: "copper_ore", qty: 1 }, { itemId: "tin_ore", qty: 1 }], bronze),
    ).toBe(true);
    expect(canCraft([{ itemId: "copper_ore", qty: 1 }], bronze)).toBe(false); // missing tin
    expect(canCraft([], bronze)).toBe(false);
  });
});

describe("craft", () => {
  it("consumes inputs and produces the output", () => {
    const inv: Inventory = [
      { itemId: "copper_ore", qty: 3 },
      { itemId: "tin_ore", qty: 2 },
    ];
    const r = craft(inv, bronze, lookup);
    expect(r.ok).toBe(true);
    expect(r.inventory).toEqual([
      { itemId: "copper_ore", qty: 2 },
      { itemId: "tin_ore", qty: 1 },
      { itemId: "bronze_bar", qty: 1 },
    ]);
  });

  it("refuses (unchanged) when an input is missing", () => {
    const inv: Inventory = [{ itemId: "copper_ore", qty: 5 }];
    const r = craft(inv, bronze, lookup);
    expect(r.ok).toBe(false);
    expect(r.inventory).toBe(inv);
  });

  it("does not mutate the input inventory", () => {
    const inv: Inventory = [
      { itemId: "copper_ore", qty: 1 },
      { itemId: "tin_ore", qty: 1 },
    ];
    craft(inv, bronze, lookup);
    expect(inv).toEqual([
      { itemId: "copper_ore", qty: 1 },
      { itemId: "tin_ore", qty: 1 },
    ]);
  });
});
