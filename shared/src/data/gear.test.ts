import { describe, it, expect } from "vitest";
import { ITEMS, EQUIP_SLOTS } from "./items";
import { MOBS } from "./mobs";
import { HUNT_REWARDS } from "./hunts";
import { QUESTS } from "./quests";

/** P15.3 gear expansion — every slot is fillable, uniques exist, acquisition
 *  spans more than crafting. Guards the content like every other data module. */
describe("gear coverage", () => {
  it("every equip slot now has at least two obtainable items", () => {
    for (const slot of EQUIP_SLOTS) {
      const n = Object.values(ITEMS).filter((i) => i.equipSlot === slot).length;
      expect(n, `slot ${slot} has only ${n} item(s)`).toBeGreaterThanOrEqual(2);
    }
  });

  it("every boss drops a unique wearable (varied acquisition, not just crafting)", () => {
    const bosses = Object.values(MOBS).filter((m) => m.boss);
    for (const boss of bosses) {
      const wearables = (boss.drops ?? []).filter((d) => ITEMS[d.itemId]?.equipSlot);
      expect(wearables.length, `${boss.kind} drops no wearable`).toBeGreaterThan(0);
    }
  });

  it("gear is obtained through drops, quests, and the hunt shop — not only recipes", () => {
    const droppedGear = new Set<string>();
    for (const m of Object.values(MOBS))
      for (const d of m.drops ?? []) if (ITEMS[d.itemId]?.equipSlot) droppedGear.add(d.itemId);
    expect(droppedGear.size).toBeGreaterThanOrEqual(8);

    const questGear = new Set<string>();
    for (const q of Object.values(QUESTS))
      for (const it of q.rewards.items ?? []) if (ITEMS[it.itemId]?.equipSlot) questGear.add(it.itemId);
    expect(questGear.size).toBeGreaterThanOrEqual(3);

    const shopGear = HUNT_REWARDS.filter((r) => ITEMS[r.itemId]?.equipSlot);
    expect(shopGear.length).toBeGreaterThanOrEqual(2);
  });

  it("all drop/quest/shop item references resolve to real items", () => {
    for (const m of Object.values(MOBS))
      for (const d of m.drops ?? []) expect(ITEMS[d.itemId], `mob ${m.kind} drops unknown ${d.itemId}`).toBeDefined();
    for (const q of Object.values(QUESTS))
      for (const it of q.rewards.items ?? []) expect(ITEMS[it.itemId], `quest ${q.id} gives unknown ${it.itemId}`).toBeDefined();
    for (const r of HUNT_REWARDS) expect(ITEMS[r.itemId], `hunt shop sells unknown ${r.itemId}`).toBeDefined();
  });

  it("the maul weapon class is now wieldable", () => {
    const mauls = Object.values(ITEMS).filter((i) => i.weaponType === "maul");
    expect(mauls.length).toBeGreaterThanOrEqual(2);
  });
});
