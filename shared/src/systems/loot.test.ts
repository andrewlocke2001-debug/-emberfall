import { describe, it, expect } from "vitest";
import { rollDrops, type DropEntry } from "./loot";

/** A scripted RNG that returns each value in turn (then repeats the last). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe("rollDrops", () => {
  it("drops an entry when the roll is under its chance", () => {
    const drops: DropEntry[] = [{ itemId: "coins", min: 5, max: 5, chance: 1 }];
    // first draw = chance roll (0.0 < 1), second = quantity roll
    expect(rollDrops(drops, seq([0.0, 0.0]))).toEqual([{ itemId: "coins", qty: 5 }]);
  });

  it("skips an entry when the chance roll fails", () => {
    const drops: DropEntry[] = [{ itemId: "coins", min: 1, max: 9, chance: 0.5 }];
    expect(rollDrops(drops, seq([0.9]))).toEqual([]); // 0.9 >= 0.5 → no drop, no qty roll
  });

  it("rolls quantity uniformly across [min, max]", () => {
    const drops: DropEntry[] = [{ itemId: "ash_pelt", min: 2, max: 4, chance: 1 }];
    // qty = 2 + floor(rng * 3): rng 0 → 2, rng ~0.5 → 3, rng ~0.99 → 4
    expect(rollDrops(drops, seq([0, 0]))[0]).toEqual({ itemId: "ash_pelt", qty: 2 });
    expect(rollDrops(drops, seq([0, 0.5]))[0]).toEqual({ itemId: "ash_pelt", qty: 3 });
    expect(rollDrops(drops, seq([0, 0.999]))[0]).toEqual({ itemId: "ash_pelt", qty: 4 });
  });

  it("evaluates every entry independently", () => {
    const drops: DropEntry[] = [
      { itemId: "coins", min: 10, max: 10, chance: 1 },
      { itemId: "rare", min: 1, max: 1, chance: 0.1 },
    ];
    // coins: drop(0) qty(0); rare: chance roll 0.05 < 0.1 → drop, qty(0)
    const r = rollDrops(drops, seq([0, 0, 0.05, 0]));
    expect(r).toEqual([
      { itemId: "coins", qty: 10 },
      { itemId: "rare", qty: 1 },
    ]);
  });

  it("returns nothing for an empty table", () => {
    expect(rollDrops([], seq([0]))).toEqual([]);
  });
});
