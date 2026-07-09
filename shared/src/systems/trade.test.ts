import { describe, it, expect } from "vitest";
import { emptyOffer, setOffer, confirmOffer, bothConfirmed } from "./trade";

describe("trade offers", () => {
  it("starts empty and unconfirmed", () => {
    expect(emptyOffer()).toEqual({ items: [], coins: 0, confirmed: false });
  });

  it("setOffer clears BOTH confirmations (a change voids agreement)", () => {
    const theirs = { ...emptyOffer(), confirmed: true };
    const res = setOffer(emptyOffer(), theirs, [{ itemId: "coins", qty: 5 }], 10);
    expect(res.mine).toEqual({ items: [{ itemId: "coins", qty: 5 }], coins: 10, confirmed: false });
    expect(res.theirs.confirmed).toBe(false); // the OTHER side's confirm was reset
  });

  it("setOffer copies items + floors/clamps coins (no mutation, no negatives)", () => {
    const items = [{ itemId: "iron_sword", qty: 1 }];
    const res = setOffer(emptyOffer(), emptyOffer(), items, -50);
    expect(res.mine.coins).toBe(0);
    res.mine.items[0]!.qty = 99;
    expect(items[0]!.qty).toBe(1); // original untouched (deep-copied)
  });

  it("bothConfirmed is true only when both sides confirmed", () => {
    const a = confirmOffer(emptyOffer());
    const b = confirmOffer(emptyOffer());
    expect(bothConfirmed(a, emptyOffer())).toBe(false);
    expect(bothConfirmed(a, b)).toBe(true);
  });
});
