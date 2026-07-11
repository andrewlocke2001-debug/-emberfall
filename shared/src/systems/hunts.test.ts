import { describe, it, expect } from "vitest";
import { rollHunt, recordHuntKill } from "./hunts";
import { HUNT_TARGETS } from "../data/hunts";

describe("rollHunt", () => {
  it("rolls a task within the target's count range", () => {
    const t = rollHunt(() => 0); // first target, min count
    expect(t).toEqual({ mob: HUNT_TARGETS[0]!.mob, remaining: HUNT_TARGETS[0]!.min, points: HUNT_TARGETS[0]!.points });
    const hi = rollHunt(() => 0.999); // last target, max count
    const last = HUNT_TARGETS[HUNT_TARGETS.length - 1]!;
    expect(hi).toEqual({ mob: last.mob, remaining: last.max, points: last.points });
  });
});

describe("recordHuntKill", () => {
  it("counts only the task's mob and pays on completion", () => {
    let r = recordHuntKill({ mob: "wolf", remaining: 2, points: 10 }, "bandit");
    expect(r).toEqual({ task: { mob: "wolf", remaining: 2, points: 10 }, earned: 0 });
    r = recordHuntKill(r.task, "wolf");
    expect(r).toEqual({ task: { mob: "wolf", remaining: 1, points: 10 }, earned: 0 });
    r = recordHuntKill(r.task, "wolf");
    expect(r).toEqual({ task: null, earned: 10 });
    expect(recordHuntKill(null, "wolf")).toEqual({ task: null, earned: 0 });
  });
});
