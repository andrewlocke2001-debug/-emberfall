import { describe, it, expect } from "vitest";
import { ITEMS } from "./items";
import { MOBS } from "./mobs";
import { NPCS } from "./npcs";
import { VENDORS } from "./vendors";
import { RESOURCES, NODES } from "./resources";
import { RECIPES } from "./recipes";
import { QUESTS } from "./quests";

/**
 * Referential integrity across all content data (kit rule #4: content is typed
 * data, validated). A typo'd item/mob/npc id is a failing test, not a runtime
 * surprise.
 */
const hasItem = (id: string, where: string): void => {
  expect(ITEMS[id], `unknown item "${id}" in ${where}`).toBeDefined();
};

describe("content integrity", () => {
  it("mob drop tables reference real items", () => {
    for (const m of Object.values(MOBS)) for (const d of m.drops) hasItem(d.itemId, `${m.kind} drops`);
  });

  it("resources yield real items, and placed nodes use real types", () => {
    for (const r of Object.values(RESOURCES)) hasItem(r.itemId, `resource ${r.type}`);
    for (const list of Object.values(NODES)) {
      for (const n of list ?? []) expect(RESOURCES[n.type], `node ${n.id} type ${n.type}`).toBeDefined();
    }
  });

  it("recipes consume + produce real items", () => {
    for (const r of Object.values(RECIPES)) {
      for (const i of r.inputs) hasItem(i.itemId, `recipe ${r.id} input`);
      hasItem(r.output.itemId, `recipe ${r.id} output`);
    }
  });

  it("vendors stock real items", () => {
    for (const v of Object.values(VENDORS)) for (const id of v.stock) hasItem(id, `vendor ${v.id}`);
  });

  it("quests reference valid items, mobs, npcs, and prerequisites", () => {
    for (const q of Object.values(QUESTS)) {
      if (q.requires) expect(QUESTS[q.requires], `${q.id} requires ${q.requires}`).toBeDefined();
      if (q.giver) expect(NPCS[q.giver], `${q.id} giver ${q.giver}`).toBeDefined();
      for (const obj of q.objectives) {
        if (obj.type === "collect") hasItem(obj.itemId, `quest ${q.id}`);
        else if (obj.type === "kill") expect(MOBS[obj.mob], `${q.id} kill ${obj.mob}`).toBeDefined();
        else expect(NPCS[obj.npcId], `${q.id} talk ${obj.npcId}`).toBeDefined();
      }
      for (const it of q.rewards.items ?? []) hasItem(it.itemId, `quest ${q.id} reward`);
    }
  });

  it("every NPC offers only real quests", () => {
    for (const n of Object.values(NPCS)) {
      for (const qid of n.quests) expect(QUESTS[qid], `${n.id} offers ${qid}`).toBeDefined();
    }
  });
});
