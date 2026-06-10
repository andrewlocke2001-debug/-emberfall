import { describe, it, expect } from "vitest";
import { stepPosition, clamp } from "./movement";

const bounds = { width: 1000, height: 1000 };

describe("stepPosition", () => {
  it("moves at `speed` units/sec along a cardinal direction", () => {
    const p = stepPosition({ x: 100, y: 100 }, { dx: 1, dy: 0 }, 1, 200, bounds);
    expect(p.x).toBeCloseTo(300);
    expect(p.y).toBeCloseTo(100);
  });

  it("normalizes diagonal movement so it is not faster than cardinal", () => {
    const p = stepPosition({ x: 0, y: 0 }, { dx: 1, dy: 1 }, 1, 100, bounds);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 5);
  });

  it("respects fractional delta time", () => {
    const p = stepPosition({ x: 0, y: 0 }, { dx: 1, dy: 0 }, 0.5, 200, bounds);
    expect(p.x).toBeCloseTo(100);
  });

  it("clamps to the zone bounds", () => {
    const p = stepPosition({ x: 990, y: 10 }, { dx: 1, dy: -1 }, 1, 1000, bounds);
    expect(p.x).toBe(1000);
    expect(p.y).toBe(0);
  });

  it("stands still with no input and does not mutate the input", () => {
    const start = { x: 42, y: 42 };
    const p = stepPosition(start, { dx: 0, dy: 0 }, 1, 200, bounds);
    expect(p).toEqual({ x: 42, y: 42 });
    expect(p).not.toBe(start);
  });
});

describe("clamp", () => {
  it("bounds values into the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
