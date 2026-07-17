import { describe, it, expect } from "vitest";
import { buyCost, sellValue } from "./shop";
import { VENDOR_BUYBACK_RATE } from "../types";
import type { ItemDef } from "../data/items";

const item = (value: number): ItemDef =>
  ({ id: "x", name: "X", rarity: "common", maxStack: 1, value }) as ItemDef;

describe("buyCost", () => {
  it("is the item value, floored, at least 1", () => {
    expect(buyCost(item(120))).toBe(120);
    expect(buyCost(item(0))).toBe(1);
  });
});

describe("sellValue", () => {
  it("is a fraction of value (the buyback rate), at least 1", () => {
    expect(sellValue(item(100))).toBe(Math.floor(100 * VENDOR_BUYBACK_RATE));
    expect(sellValue(item(1))).toBe(1); // floor(0.4) → clamped to 1
  });

  it("is always below the buy cost (the spread is the sink)", () => {
    expect(sellValue(item(100))).toBeLessThan(buyCost(item(100)));
  });
});

describe("sellValue for equipment", () => {
  const gear = (value: number): ItemDef =>
    ({ id: "g", name: "G", rarity: "common", maxStack: 1, value, equipSlot: "weapon" }) as ItemDef;

  it("gear sells at the worse GEAR_BUYBACK_RATE (anti craft-and-dump)", () => {
    expect(sellValue(gear(100))).toBe(15);
    expect(sellValue(gear(100))).toBeLessThan(sellValue(item(100)));
  });
});
