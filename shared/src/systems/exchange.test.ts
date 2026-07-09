import { describe, it, expect } from "vitest";
import { matchOrder, exchangeTax, sellerProceeds, type Order } from "./exchange";
import { EXCHANGE_TAX_RATE } from "../types";

const order = (o: Partial<Order> & Pick<Order, "id" | "side" | "price">): Order => ({
  itemId: "iron_ore",
  remaining: 10,
  createdAt: 0,
  ...o,
});

describe("matchOrder", () => {
  it("a buy crosses a cheaper sell and executes at the SELL's price", () => {
    const book = [order({ id: "s1", side: "sell", price: 5, remaining: 10 })];
    const res = matchOrder(order({ id: "b1", side: "buy", price: 8, remaining: 4 }), book);
    expect(res.fills).toEqual([
      { buyOrderId: "b1", sellOrderId: "s1", itemId: "iron_ore", qty: 4, price: 5 },
    ]);
    expect(res.incomingRemaining).toBe(0);
    expect(res.restingUpdates).toEqual([{ id: "s1", remaining: 6 }]);
  });

  it("does not cross when the price gap is wrong (rests instead)", () => {
    const book = [order({ id: "s1", side: "sell", price: 10 })];
    const res = matchOrder(order({ id: "b1", side: "buy", price: 5, remaining: 3 }), book);
    expect(res.fills).toHaveLength(0);
    expect(res.incomingRemaining).toBe(3);
  });

  it("takes the best price first, then oldest at equal price (price-time)", () => {
    const book = [
      order({ id: "s_old_6", side: "sell", price: 6, remaining: 5, createdAt: 1 }),
      order({ id: "s_cheap", side: "sell", price: 5, remaining: 5, createdAt: 2 }),
      order({ id: "s_new_6", side: "sell", price: 6, remaining: 5, createdAt: 3 }),
    ];
    const res = matchOrder(order({ id: "b1", side: "buy", price: 6, remaining: 12 }), book);
    // cheapest (5) fully, then the older 6, then part of the newer 6.
    expect(res.fills.map((f) => [f.sellOrderId, f.qty, f.price])).toEqual([
      ["s_cheap", 5, 5],
      ["s_old_6", 5, 6],
      ["s_new_6", 2, 6],
    ]);
    expect(res.incomingRemaining).toBe(0);
  });

  it("a sell hits the highest buy first and leaves a remainder resting", () => {
    const book = [
      order({ id: "b_low", side: "buy", price: 4, remaining: 10 }),
      order({ id: "b_high", side: "buy", price: 7, remaining: 3 }),
    ];
    const res = matchOrder(order({ id: "s1", side: "sell", price: 5, remaining: 8 }), book);
    // Only the high buy (7 >= 5) crosses; the 4 buy does not.
    expect(res.fills).toEqual([
      { buyOrderId: "b_high", sellOrderId: "s1", itemId: "iron_ore", qty: 3, price: 7 },
    ]);
    expect(res.incomingRemaining).toBe(5);
  });

  it("ignores other items and same-side orders; never mutates inputs", () => {
    const book = [
      order({ id: "s_other", side: "sell", price: 1, itemId: "copper_ore" }),
      order({ id: "b_same", side: "buy", price: 99 }),
      order({ id: "s_ok", side: "sell", price: 5, remaining: 2 }),
    ];
    const snapshot = JSON.stringify(book);
    const res = matchOrder(order({ id: "b1", side: "buy", price: 5, remaining: 10 }), book);
    expect(res.fills.map((f) => f.sellOrderId)).toEqual(["s_ok"]);
    expect(res.incomingRemaining).toBe(8);
    expect(JSON.stringify(book)).toBe(snapshot); // inputs untouched
  });
});

describe("exchange tax", () => {
  it("takes EXCHANGE_TAX_RATE off the gross (floored), leaving the rest", () => {
    expect(exchangeTax(1000)).toBe(Math.floor(1000 * EXCHANGE_TAX_RATE));
    expect(sellerProceeds(1000)).toBe(1000 - Math.floor(1000 * EXCHANGE_TAX_RATE));
    expect(exchangeTax(0)).toBe(0);
  });
});
