import { describe, it, expect } from "vitest";
import {
  talentPointsFor,
  pointsSpent,
  pruneToWeb,
  isReachable,
  canSpendTalent,
  applyTalentStats,
  talentMaxHpBonus,
  talentGcdMs,
  talentLifesteal,
  talentExecuteAdjust,
  talentCritChance,
  talentEnergyCostMul,
  talentHealMul,
} from "./callings";
import { CALLING_IDS } from "../data/callings";
import { WEB_NODES, WEB_EDGES, WEB_ADJACENCY, WEB_STARTS, webNode } from "../data/web";

const stats = { attack: 50, strength: 50, defence: 50, hp: 100, maxHp: 100, alive: true };

describe("passive web content", () => {
  it("is one connected graph with a distinct start per Calling", () => {
    // Every Calling has a start node, and they're all different.
    const starts = CALLING_IDS.map((c) => WEB_STARTS[c]);
    expect(new Set(starts).size).toBe(CALLING_IDS.length);
    for (const s of starts) expect(webNode(s)).toBeDefined();

    // Many nodes (the ask): a big web, all with effects and valid positions.
    expect(Object.keys(WEB_NODES).length).toBeGreaterThan(90);
    for (const n of Object.values(WEB_NODES)) {
      expect(Object.keys(n.effects).length).toBeGreaterThan(0);
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
    }

    // Edges reference real nodes; the whole graph is one connected component
    // reachable from any start (so cross-class travel is always possible).
    for (const [a, b] of WEB_EDGES) {
      expect(webNode(a), `edge from unknown ${a}`).toBeDefined();
      expect(webNode(b), `edge to unknown ${b}`).toBeDefined();
    }
    const seen = new Set<string>([WEB_STARTS.warden]);
    const stack = [WEB_STARTS.warden];
    while (stack.length) {
      for (const n of WEB_ADJACENCY[stack.pop()!] ?? []) {
        if (!seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    expect(seen.size).toBe(Object.keys(WEB_NODES).length);
  });

  it("keystones exist and are far from the center", () => {
    const keys = Object.values(WEB_NODES).filter((n) => n.kind === "keystone");
    expect(keys.length).toBe(CALLING_IDS.length);
    for (const k of keys) expect(Math.hypot(k.x, k.y)).toBeGreaterThan(380);
  });
});

describe("talentPointsFor", () => {
  it("is 40% of the highest combat level", () => {
    expect(talentPointsFor(1, 1, 1)).toBe(0);
    expect(talentPointsFor(10, 1, 1)).toBe(4);
    expect(talentPointsFor(3, 40, 2)).toBe(16);
    expect(talentPointsFor(50, 50, 50)).toBe(20);
  });
});

describe("web allocation (canSpendTalent / isReachable)", () => {
  const gate = WEB_STARTS.warden;
  const nextToGate = (WEB_ADJACENCY[gate] ?? [])[0]!;

  it("only allocates nodes adjacent to owned ones, gated by calling + points", () => {
    // A node next to the free gate is reachable from an empty allocation.
    expect(isReachable("warden", {}, nextToGate)).toBe(true);
    expect(canSpendTalent("warden", {}, nextToGate, 5)).toBe(true);
    // No calling → nothing allocatable.
    expect(canSpendTalent("", {}, nextToGate, 5)).toBe(false);
    // Out of points.
    expect(canSpendTalent("warden", {}, nextToGate, 0)).toBe(false);
    // The gate itself is already owned — can't re-allocate.
    expect(isReachable("warden", {}, gate)).toBe(false);
    // A far node (a different Calling's keystone) is not adjacent to the gate.
    expect(isReachable("warden", {}, WEB_STARTS.reaver)).toBe(false);
  });

  it("allocation opens up new neighbors (the web grows outward)", () => {
    const owned = { [nextToGate]: 1 };
    const beyond = (WEB_ADJACENCY[nextToGate] ?? []).find((n) => n !== gate)!;
    expect(isReachable("warden", owned, beyond)).toBe(true);
  });

  it("pruneToWeb drops stale (non-web) allocations", () => {
    const pruned = pruneToWeb({ [nextToGate]: 1, warden_old_dead_talent: 3 });
    expect(pruned[nextToGate]).toBe(1);
    expect(pruned.warden_old_dead_talent).toBeUndefined();
    expect(pointsSpent(pruned)).toBe(1);
  });
});

describe("effect application reads web nodes", () => {
  it("sums the allocated nodes' effects onto the sheet", () => {
    // Allocate the warden keystone (defence + HP) and check it lands.
    const key = Object.values(WEB_NODES).find((n) => n.name === "The Thousand Hearths")!;
    const talents = { [key.id]: 1 };
    const out = applyTalentStats(stats, talents);
    expect(out.defence).toBe(Math.round(50 * (1 + (key.effects.defencePct ?? 0) / 100)));
    expect(talentMaxHpBonus(talents)).toBe(key.effects.maxHpFlat ?? 0);
    expect(stats.defence).toBe(50); // pure — input untouched
  });

  it("every knob reads its field", () => {
    const crit = Object.values(WEB_NODES).find((n) => n.effects.critChance)!;
    expect(talentCritChance({ [crit.id]: 1 })).toBeCloseTo((crit.effects.critChance ?? 0) / 100);
    const gcd = Object.values(WEB_NODES).find((n) => n.effects.gcdPct)!;
    expect(talentGcdMs({ [gcd.id]: 1 }, 1500)).toBe(Math.round(1500 * (1 - (gcd.effects.gcdPct ?? 0) / 100)));
    const life = Object.values(WEB_NODES).find((n) => n.effects.lifesteal);
    if (life) expect(talentLifesteal({ [life.id]: 1 })).toBe(life.effects.lifesteal);
    const energy = Object.values(WEB_NODES).find((n) => n.effects.energyCostPct)!;
    expect(talentEnergyCostMul({ [energy.id]: 1 })).toBeCloseTo(1 - (energy.effects.energyCostPct ?? 0) / 100);
    const heal = Object.values(WEB_NODES).find((n) => n.effects.healPowerPct)!;
    expect(talentHealMul({ [heal.id]: 1 })).toBeCloseTo(1 + (heal.effects.healPowerPct ?? 0) / 100);
    const exec = Object.values(WEB_NODES).find((n) => n.effects.executePct)!;
    expect(talentExecuteAdjust(100, 29, 100, { [exec.id]: 1 })).toBe(
      Math.round(100 * (1 + (exec.effects.executePct ?? 0) / 100)),
    );
    expect(talentExecuteAdjust(100, 31, 100, { [exec.id]: 1 })).toBe(100); // above 30% HP
  });

  it("crit chance is capped at 50%", () => {
    const critNodes = Object.values(WEB_NODES).filter((n) => n.effects.critChance);
    const stacked: Record<string, number> = {};
    for (const n of critNodes) stacked[n.id] = 1;
    expect(talentCritChance(stacked)).toBeLessThanOrEqual(0.5);
  });
});
