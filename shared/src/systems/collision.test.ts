import { describe, it, expect } from "vitest";
import { buildCollisionGrid, isSolidAtCell, isBoxFree, stepWithCollision } from "./collision";

/**
 * A 5×3 grid, tile size 10. `#` solid, `.` open:
 *   . . . . .
 *   . # # . .
 *   . . . . .
 */
const obstacles = [
  0, 0, 0, 0, 0,
  0, 1, 1, 0, 0,
  0, 0, 0, 0, 0,
];
const grid = buildCollisionGrid(5, 3, 10, obstacles);

describe("buildCollisionGrid", () => {
  it("rejects a cell count that doesn't match cols*rows", () => {
    expect(() => buildCollisionGrid(2, 2, 10, [0, 0, 0])).toThrow();
  });
});

describe("isSolidAtCell", () => {
  it("reads solid/open cells", () => {
    expect(isSolidAtCell(grid, 1, 1)).toBe(true);
    expect(isSolidAtCell(grid, 0, 0)).toBe(false);
  });
  it("treats out-of-bounds as solid (walls at the world edge)", () => {
    expect(isSolidAtCell(grid, -1, 0)).toBe(true);
    expect(isSolidAtCell(grid, 5, 0)).toBe(true);
  });
});

describe("isBoxFree", () => {
  it("is free in open space", () => {
    expect(isBoxFree(grid, 35, 5, 4)).toBe(true); // around cell (3,0)
  });
  it("collides when the box overlaps a solid cell", () => {
    expect(isBoxFree(grid, 15, 15, 4)).toBe(false); // cell (1,1) is solid
  });
});

describe("stepWithCollision", () => {
  it("moves freely through open space", () => {
    const p = stepWithCollision({ x: 5, y: 5 }, { dx: 1, dy: 0 }, 0.1, 50, grid, 3);
    expect(p.x).toBeGreaterThan(5);
    expect(p.y).toBeCloseTo(5);
  });

  it("slides along a wall instead of stopping dead (axis separation)", () => {
    // From (5,5) moving down-right toward the block at cells (1,1)/(2,1)
    // (x[10..30], y[10..20]): the X axis is open along row 0 so it advances,
    // while the Y axis is blocked — diagonal-into-wall keeps moving, doesn't
    // dead-stop, and never enters a solid cell.
    const start = { x: 5, y: 5 };
    const p = stepWithCollision(start, { dx: 1, dy: 1 }, 0.2, 50, grid, 3);
    expect(p.x).toBeGreaterThan(start.x);
    expect(isBoxFree(grid, p.x, p.y, 3)).toBe(true);
  });

  it("never enters a solid cell", () => {
    let pos = { x: 5, y: 15 }; // open cell (0,1), wall is to the right at (1,1)
    for (let i = 0; i < 20; i++) {
      pos = stepWithCollision(pos, { dx: 1, dy: 0 }, 0.1, 50, grid, 3);
    }
    expect(isBoxFree(grid, pos.x, pos.y, 3)).toBe(true);
    expect(pos.x).toBeLessThan(10); // stopped before the solid column at x=10
  });

  it("clamps to the world bounds", () => {
    const p = stepWithCollision({ x: 5, y: 5 }, { dx: -1, dy: -1 }, 1, 1000, grid, 3);
    expect(p.x).toBeGreaterThanOrEqual(3);
    expect(p.y).toBeGreaterThanOrEqual(3);
  });
});
