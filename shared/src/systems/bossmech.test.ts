import { describe, expect, it } from "vitest";
import { chargeStep, hazardDpsAt, inChargePath, phaseMods } from "./bossmech";

describe("phaseMods", () => {
  const mech = { phase: { pct: 0.5, windupMult: 0.7, radiusMult: 1.3, damageMult: 1.2, moveMult: 1.4 } };

  it("is identity above the threshold", () => {
    const m = phaseMods(mech, 60, 100);
    expect(m.active).toBe(false);
    expect(m.windupMult).toBe(1);
    expect(m.damageMult).toBe(1);
  });

  it("activates at and below the threshold", () => {
    const m = phaseMods(mech, 50, 100);
    expect(m.active).toBe(true);
    expect(m.windupMult).toBe(0.7);
    expect(m.radiusMult).toBe(1.3);
    expect(m.damageMult).toBe(1.2);
    expect(m.moveMult).toBe(1.4);
  });

  it("defaults unspecified multipliers to 1", () => {
    const m = phaseMods({ phase: { pct: 0.5 } }, 10, 100);
    expect(m.active).toBe(true);
    expect(m.windupMult).toBe(1);
    expect(m.moveMult).toBe(1);
  });

  it("is identity with no phase configured", () => {
    expect(phaseMods(undefined, 1, 100).active).toBe(false);
    expect(phaseMods({}, 1, 100).active).toBe(false);
  });
});

describe("hazardDpsAt", () => {
  const pools = [
    { x: 0, y: 0, radius: 50, dps: 10, until: 1000 },
    { x: 30, y: 0, radius: 50, dps: 8, until: 1000 },
    { x: 500, y: 500, radius: 50, dps: 99, until: 1000 },
  ];

  it("sums overlapping live pools", () => {
    expect(hazardDpsAt(pools, 10, 0, 0)).toBe(18); // inside both
    expect(hazardDpsAt(pools, -45, 0, 0)).toBe(10); // inside first only
    expect(hazardDpsAt(pools, 200, 200, 0)).toBe(0); // in neither
  });

  it("ignores expired pools", () => {
    expect(hazardDpsAt(pools, 10, 0, 1000)).toBe(0);
  });

  it("counts the exact rim as inside", () => {
    expect(hazardDpsAt([{ x: 0, y: 0, radius: 50, dps: 5, until: 10 }], 50, 0, 0)).toBe(5);
  });
});

describe("chargeStep", () => {
  it("advances along the line at speed*dt", () => {
    const s = chargeStep(0, 0, 100, 0, 400, 0.05); // 20 units
    expect(s.x).toBeCloseTo(20);
    expect(s.y).toBeCloseTo(0);
    expect(s.arrived).toBe(false);
  });

  it("snaps to the destination when the step overshoots", () => {
    const s = chargeStep(90, 0, 100, 0, 400, 0.05);
    expect(s.x).toBe(100);
    expect(s.arrived).toBe(true);
  });

  it("arrives immediately when already there", () => {
    expect(chargeStep(5, 5, 5, 5, 400, 0.05).arrived).toBe(true);
  });
});

describe("inChargePath", () => {
  it("hits within the width and misses outside it", () => {
    expect(inChargePath(0, 0, 30, 0, 40)).toBe(true);
    expect(inChargePath(0, 0, 50, 0, 40)).toBe(false);
  });
});
