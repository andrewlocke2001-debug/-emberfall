import { describe, it, expect } from "vitest";
import { addItem, removeItem, countItem, canAdd, type Inventory } from "./inventory";
import { INVENTORY_SLOTS } from "../types";

describe("addItem", () => {
  it("opens a new stack in an empty inventory", () => {
    const r = addItem([], "coins", 50, 1000);
    expect(r.added).toBe(50);
    expect(r.inventory).toEqual([{ itemId: "coins", qty: 50 }]);
  });

  it("tops up an existing stack before opening a new one", () => {
    const inv: Inventory = [{ itemId: "health_potion", qty: 18 }];
    const r = addItem(inv, "health_potion", 5, 20);
    // 2 fill the first stack to 20, 3 spill into a new stack
    expect(r.added).toBe(5);
    expect(r.inventory).toEqual([
      { itemId: "health_potion", qty: 20 },
      { itemId: "health_potion", qty: 3 },
    ]);
  });

  it("does not mutate the input inventory", () => {
    const inv: Inventory = [{ itemId: "coins", qty: 1 }];
    addItem(inv, "coins", 9, 1000);
    expect(inv).toEqual([{ itemId: "coins", qty: 1 }]);
  });

  it("reports overflow when the 28-slot cap is reached", () => {
    // Fill all 28 slots with unstackable swords, then try to add one more.
    let inv: Inventory = [];
    for (let i = 0; i < INVENTORY_SLOTS; i++) inv = addItem(inv, "bronze_sword", 1, 1).inventory;
    expect(inv).toHaveLength(INVENTORY_SLOTS);
    const r = addItem(inv, "iron_sword", 1, 1);
    expect(r.added).toBe(0);
    expect(r.inventory).toHaveLength(INVENTORY_SLOTS);
  });

  it("partially fills when only some units fit", () => {
    // 27 swords used; one free slot left, each sword is its own slot.
    let inv: Inventory = [];
    for (let i = 0; i < INVENTORY_SLOTS - 1; i++) inv = addItem(inv, "bronze_sword", 1, 1).inventory;
    const r = addItem(inv, "bronze_sword", 5, 1); // only 1 slot remains
    expect(r.added).toBe(1);
    expect(r.inventory).toHaveLength(INVENTORY_SLOTS);
  });
});

describe("canAdd", () => {
  it("is true when everything fits and false on overflow", () => {
    expect(canAdd([], "coins", 100, 1000)).toBe(true);
    let inv: Inventory = [];
    for (let i = 0; i < INVENTORY_SLOTS; i++) inv = addItem(inv, "bronze_sword", 1, 1).inventory;
    expect(canAdd(inv, "iron_sword", 1, 1)).toBe(false);
  });
});

describe("removeItem", () => {
  it("drains stacks and drops empty ones", () => {
    const inv: Inventory = [
      { itemId: "coins", qty: 10 },
      { itemId: "coins", qty: 5 },
    ];
    const r = removeItem(inv, "coins", 12);
    expect(r.removed).toBe(12);
    // First stack emptied (removed), second drained to 3.
    expect(r.inventory).toEqual([{ itemId: "coins", qty: 3 }]);
  });

  it("removes only what's present and reports the shortfall", () => {
    const inv: Inventory = [{ itemId: "ash_pelt", qty: 2 }];
    const r = removeItem(inv, "ash_pelt", 5);
    expect(r.removed).toBe(2);
    expect(r.inventory).toEqual([]);
  });

  it("does not mutate the input inventory", () => {
    const inv: Inventory = [{ itemId: "coins", qty: 10 }];
    removeItem(inv, "coins", 4);
    expect(inv).toEqual([{ itemId: "coins", qty: 10 }]);
  });
});

describe("countItem", () => {
  it("sums quantity across stacks", () => {
    const inv: Inventory = [
      { itemId: "coins", qty: 10 },
      { itemId: "ash_pelt", qty: 3 },
      { itemId: "coins", qty: 7 },
    ];
    expect(countItem(inv, "coins")).toBe(17);
    expect(countItem(inv, "ash_pelt")).toBe(3);
    expect(countItem(inv, "iron_sword")).toBe(0);
  });
});
