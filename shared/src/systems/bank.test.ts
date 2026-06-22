import { describe, it, expect } from "vitest";
import { deposit, withdraw } from "./bank";
import type { Inventory } from "./inventory";

describe("deposit", () => {
  it("moves a stack from the bag into the bank", () => {
    const inv: Inventory = [{ itemId: "coins", qty: 100 }];
    const r = deposit(inv, [], "coins", 60, 1_000_000);
    expect(r.moved).toBe(60);
    expect(r.inventory).toEqual([{ itemId: "coins", qty: 40 }]);
    expect(r.bank).toEqual([{ itemId: "coins", qty: 60 }]);
  });

  it("only deposits what's actually held", () => {
    const inv: Inventory = [{ itemId: "ash_pelt", qty: 3 }];
    const r = deposit(inv, [], "ash_pelt", 10, 1_000_000);
    expect(r.moved).toBe(3);
    expect(r.inventory).toEqual([]);
    expect(r.bank).toEqual([{ itemId: "ash_pelt", qty: 3 }]);
  });

  it("merges into an existing bank stack", () => {
    const inv: Inventory = [{ itemId: "coins", qty: 50 }];
    const bank = [{ itemId: "coins", qty: 200 }];
    const r = deposit(inv, bank, "coins", 50, 1_000_000);
    expect(r.bank).toEqual([{ itemId: "coins", qty: 250 }]);
    expect(r.inventory).toEqual([]);
  });

  it("does not mutate inputs", () => {
    const inv: Inventory = [{ itemId: "coins", qty: 10 }];
    const bank: Inventory = [];
    deposit(inv, bank, "coins", 5, 1_000_000);
    expect(inv).toEqual([{ itemId: "coins", qty: 10 }]);
    expect(bank).toEqual([]);
  });
});

describe("withdraw", () => {
  it("moves a stack from the bank into the bag", () => {
    const bank = [{ itemId: "coins", qty: 100 }];
    const r = withdraw([], bank, "coins", 40, 1_000_000);
    expect(r.moved).toBe(40);
    expect(r.bank).toEqual([{ itemId: "coins", qty: 60 }]);
    expect(r.inventory).toEqual([{ itemId: "coins", qty: 40 }]);
  });

  it("only withdraws what the bank holds", () => {
    const bank = [{ itemId: "ash_pelt", qty: 2 }];
    const r = withdraw([], bank, "ash_pelt", 10, 1_000_000);
    expect(r.moved).toBe(2);
    expect(r.bank).toEqual([]);
    expect(r.inventory).toEqual([{ itemId: "ash_pelt", qty: 2 }]);
  });
});

describe("deposit + withdraw round-trip", () => {
  it("conserves total quantity (no dupes, no loss)", () => {
    const inv: Inventory = [{ itemId: "coins", qty: 100 }];
    const d = deposit(inv, [], "coins", 100, 1_000_000);
    const w = withdraw(d.inventory, d.bank, "coins", 100, 1_000_000);
    expect(w.inventory).toEqual([{ itemId: "coins", qty: 100 }]);
    expect(w.bank).toEqual([]);
  });
});
