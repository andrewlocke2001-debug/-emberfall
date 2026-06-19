import { describe, it, expect } from "vitest";
import { equip, unequip, equipmentBonus, type Equipment } from "./equipment";
import type { Inventory } from "./inventory";
import type { ItemDef } from "../data/items";

// Tiny fake item table so the tests don't depend on the live roster.
const DEFS: Record<string, ItemDef> = {
  sword: { id: "sword", name: "Sword", rarity: "common", maxStack: 1, value: 10, equipSlot: "weapon", bonus: { attack: 3, strength: 4 } },
  axe: { id: "axe", name: "Axe", rarity: "common", maxStack: 1, value: 12, equipSlot: "weapon", bonus: { strength: 6 } },
  vest: { id: "vest", name: "Vest", rarity: "common", maxStack: 1, value: 8, equipSlot: "body", bonus: { defence: 4, maxHp: 6 } },
  potion: { id: "potion", name: "Potion", rarity: "common", maxStack: 20, value: 5, heal: 40 },
};
const lookup = (id: string): ItemDef | undefined => DEFS[id];

describe("equip", () => {
  it("moves an item from the bag into its slot", () => {
    const r = equip([{ itemId: "sword", qty: 1 }], {}, "sword", lookup);
    expect(r.ok).toBe(true);
    expect(r.equipment).toEqual({ weapon: "sword" });
    expect(r.inventory).toEqual([]);
  });

  it("swaps the previously equipped item back into the bag", () => {
    const r = equip([{ itemId: "axe", qty: 1 }], { weapon: "sword" }, "axe", lookup);
    expect(r.ok).toBe(true);
    expect(r.equipment).toEqual({ weapon: "axe" });
    expect(r.inventory).toEqual([{ itemId: "sword", qty: 1 }]);
  });

  it("refuses items not in the bag", () => {
    const r = equip([], {}, "sword", lookup);
    expect(r.ok).toBe(false);
    expect(r.equipment).toEqual({});
  });

  it("refuses non-equippable items", () => {
    const inv: Inventory = [{ itemId: "potion", qty: 1 }];
    const r = equip(inv, {}, "potion", lookup);
    expect(r.ok).toBe(false);
    expect(r.inventory).toBe(inv); // unchanged reference on refusal
  });

  it("does not mutate inputs", () => {
    const inv: Inventory = [{ itemId: "sword", qty: 1 }];
    const eq: Equipment = {};
    equip(inv, eq, "sword", lookup);
    expect(inv).toEqual([{ itemId: "sword", qty: 1 }]);
    expect(eq).toEqual({});
  });
});

describe("unequip", () => {
  it("returns the slot's item to the bag and clears the slot", () => {
    const r = unequip([], { weapon: "sword" }, "weapon", lookup);
    expect(r.ok).toBe(true);
    expect(r.equipment).toEqual({});
    expect(r.inventory).toEqual([{ itemId: "sword", qty: 1 }]);
  });

  it("refuses an empty slot", () => {
    const r = unequip([], {}, "weapon", lookup);
    expect(r.ok).toBe(false);
  });
});

describe("equipmentBonus", () => {
  it("sums bonuses across slots, defaulting missing fields to 0", () => {
    const eq: Equipment = { weapon: "sword", body: "vest" };
    expect(equipmentBonus(eq, lookup)).toEqual({ attack: 3, strength: 4, defence: 4, maxHp: 6 });
  });

  it("is all-zero for empty equipment", () => {
    expect(equipmentBonus({}, lookup)).toEqual({ attack: 0, strength: 0, defence: 0, maxHp: 0 });
  });
});
