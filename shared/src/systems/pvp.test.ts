import { describe, it, expect } from "vitest";
import { canAttack, deathDrops } from "./pvp";
import { PVP_LEVEL_BAND } from "../types";
import { itemDef } from "../data/items";

describe("canAttack", () => {
  it("allows only within the level band", () => {
    expect(canAttack(10, 10 + PVP_LEVEL_BAND)).toBe(true);
    expect(canAttack(10, 10 + PVP_LEVEL_BAND + 1)).toBe(false);
    expect(canAttack(40, 10)).toBe(false);
  });
});

describe("deathDrops", () => {
  it("drops the 3 most valuable units + all coins", () => {
    // iron_sword 120, bronze_sword 25, health_potion 15, copper_ore 3.
    const inv = [
      { itemId: "copper_ore", qty: 5 },
      { itemId: "iron_sword", qty: 1 },
      { itemId: "health_potion", qty: 2 },
      { itemId: "bronze_sword", qty: 1 },
      { itemId: "coins", qty: 77 },
    ];
    const { drops, remaining } = deathDrops(inv, itemDef);
    const get = (id: string): number => drops.find((d) => d.itemId === id)?.qty ?? 0;
    expect(get("iron_sword")).toBe(1);
    expect(get("bronze_sword")).toBe(1);
    expect(get("health_potion")).toBe(1); // the 3rd most valuable unit
    expect(get("coins")).toBe(77);
    expect(get("copper_ore")).toBe(0);
    expect(remaining.find((s) => s.itemId === "coins")).toBeUndefined();
    expect(remaining.find((s) => s.itemId === "health_potion")?.qty).toBe(1);
  });

  it("handles duplicate-stack units and small bags", () => {
    // 2 potions are the two most valuable units available.
    const inv = [{ itemId: "health_potion", qty: 2 }];
    const { drops, remaining } = deathDrops(inv, itemDef);
    expect(drops).toEqual([{ itemId: "health_potion", qty: 2 }]);
    expect(remaining).toEqual([]);
  });

  it("empty bag drops nothing", () => {
    expect(deathDrops([], itemDef)).toEqual({ drops: [], remaining: [] });
  });
});
