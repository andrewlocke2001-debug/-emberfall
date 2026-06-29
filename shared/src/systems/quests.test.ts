import { describe, it, expect } from "vitest";
import {
  acceptQuest,
  canAccept,
  recordKill,
  recordTalk,
  objectiveStatus,
  questReady,
  completeQuest,
  type QuestLog,
} from "./quests";
import type { QuestDef } from "../data/quests";

const collectQuest: QuestDef = {
  id: "gather",
  name: "Gather",
  summary: "",
  objectives: [{ type: "collect", itemId: "copper_ore", count: 3, desc: "" }],
  rewards: { coins: 10 },
};
const killQuest: QuestDef = {
  id: "cull",
  name: "Cull",
  summary: "",
  objectives: [{ type: "kill", mob: "wolf", count: 2, desc: "" }],
  rewards: { coins: 10 },
  requires: "gather",
};
const lookup = (id: string): QuestDef | undefined =>
  id === "gather" ? collectQuest : id === "cull" ? killQuest : undefined;

describe("canAccept / acceptQuest", () => {
  it("accepts a fresh quest and refuses a duplicate", () => {
    const log = acceptQuest([], collectQuest);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ questId: "gather", status: "active", progress: [0] });
    expect(canAccept(log, collectQuest)).toBe(false);
  });

  it("gates a quest behind its prerequisite", () => {
    expect(canAccept([], killQuest)).toBe(false); // gather not complete
    let log = acceptQuest([], collectQuest);
    log = completeQuest(log, "gather");
    expect(canAccept(log, killQuest)).toBe(true);
  });
});

describe("recordKill", () => {
  // killQuest has a prerequisite, so build its active log entry directly.
  const active = (): QuestLog => [{ questId: "cull", status: "active", progress: [0] }];

  it("bumps a matching kill objective on active quests, capped at the count", () => {
    let log = active();
    log = recordKill(log, "wolf", lookup);
    expect(log[0]!.progress).toEqual([1]);
    log = recordKill(log, "wolf", lookup);
    log = recordKill(log, "wolf", lookup); // 3rd kill, capped at 2
    expect(log[0]!.progress).toEqual([2]);
  });

  it("ignores non-matching mobs and completed quests", () => {
    let log = active();
    log = recordKill(log, "emberling", lookup);
    expect(log[0]!.progress).toEqual([0]);
    log = completeQuest(log, "cull");
    log = recordKill(log, "wolf", lookup);
    expect(log[0]!.progress).toEqual([0]); // completed → no progress
  });
});

describe("recordTalk", () => {
  const talkQuest: QuestDef = {
    id: "greet",
    name: "Greet",
    summary: "",
    objectives: [{ type: "talk", npcId: "mira", desc: "" }],
    rewards: {},
  };
  const talkLookup = (id: string): QuestDef | undefined => (id === "greet" ? talkQuest : undefined);

  it("completes a talk objective for the matching NPC only", () => {
    let log = acceptQuest([], talkQuest);
    log = recordTalk(log, "dorin", talkLookup);
    expect(log[0]!.progress).toEqual([0]);
    log = recordTalk(log, "mira", talkLookup);
    expect(log[0]!.progress).toEqual([1]);
    expect(questReady(talkQuest, log[0]!, [])).toBe(true);
  });
});

describe("objectiveStatus / questReady", () => {
  it("checks collect objectives against the live bag", () => {
    const qp = { questId: "gather", status: "active" as const, progress: [0] };
    expect(questReady(collectQuest, qp, [{ itemId: "copper_ore", qty: 2 }])).toBe(false);
    expect(questReady(collectQuest, qp, [{ itemId: "copper_ore", qty: 3 }])).toBe(true);
  });

  it("checks kill objectives against the stored counter", () => {
    const obj = killQuest.objectives[0]!;
    expect(objectiveStatus(obj, 1, [])).toMatchObject({ current: 1, required: 2, done: false });
    expect(objectiveStatus(obj, 2, [])).toMatchObject({ done: true });
  });
});
