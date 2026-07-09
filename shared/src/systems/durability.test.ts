import { describe, it, expect } from "vitest";
import {
  hasDurability,
  wear,
  isBroken,
  repairCost,
  currentDurability,
  effectiveEquipment,
} from "./durability";
import { REPAIR_COST_RATE } from "../types";
import { itemDef } from "../data/items";
import type { ItemDef } from "../data/items";

const gear = (value: number, maxDurability?: number): ItemDef =>
  ({ id: "g", name: "G", rarity: "common", maxStack: 1, value, maxDurability }) as ItemDef;

describe("hasDurability", () => {
  it("is true only for items with a positive maxDurability", () => {
    expect(hasDurability(gear(100, 50))).toBe(true);
    expect(hasDurability(gear(100))).toBe(false);
    expect(hasDurability(gear(100, 0))).toBe(false);
  });
});

describe("wear", () => {
  it("reduces durability and clamps at zero", () => {
    expect(wear(10)).toBe(9);
    expect(wear(10, 3)).toBe(7);
    expect(wear(1, 5)).toBe(0);
    expect(wear(0)).toBe(0);
  });
});

describe("isBroken", () => {
  it("is true at or below zero", () => {
    expect(isBroken(0)).toBe(true);
    expect(isBroken(1)).toBe(false);
  });
});

describe("repairCost", () => {
  it("is zero at full durability and scales with the missing fraction", () => {
    const def = gear(100, 100);
    expect(repairCost(def, 100)).toBe(0);
    // Half worn → half of value*rate.
    expect(repairCost(def, 50)).toBe(Math.round(100 * REPAIR_COST_RATE * 0.5));
    // Fully broken → full value*rate.
    expect(repairCost(def, 0)).toBe(Math.round(100 * REPAIR_COST_RATE));
  });

  it("charges at least 1 coin for any wear, and 0 for non-gear", () => {
    expect(repairCost(gear(1, 100), 99)).toBe(1); // tiny missing fraction rounds up to 1
    expect(repairCost(gear(100), 0)).toBe(0); // no maxDurability → not repairable
  });
});

describe("currentDurability", () => {
  it("defaults to the item's max when the id is untracked", () => {
    const def = itemDef("bronze_sword")!;
    expect(currentDurability(def, {})).toBe(def.maxDurability);
    expect(currentDurability(def, { bronze_sword: 40 })).toBe(40);
  });
});

describe("effectiveEquipment", () => {
  it("drops broken gear (durability 0) but keeps worn/undamaged gear", () => {
    const equipment = { weapon: "bronze_sword", body: "leather_body" };
    // Sword broken, body fine → only the body still grants a bonus.
    const eff = effectiveEquipment(equipment, { bronze_sword: 0, leather_body: 90 }, itemDef);
    expect(eff).toEqual({ body: "leather_body" });
    // Untracked (undamaged) gear is all effective.
    expect(effectiveEquipment(equipment, {}, itemDef)).toEqual(equipment);
  });
});
