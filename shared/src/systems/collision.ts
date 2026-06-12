import type { Vec2 } from "../types";
import type { MoveDir } from "./movement";

/** A solid/walkable grid derived from a map's obstacle layer. */
export interface CollisionGrid {
  cols: number;
  rows: number;
  tileSize: number;
  /** Row-major; true = solid. */
  solid: readonly boolean[];
}

export function buildCollisionGrid(
  cols: number,
  rows: number,
  tileSize: number,
  obstacleGids: readonly number[],
): CollisionGrid {
  if (obstacleGids.length !== cols * rows) {
    throw new Error(`collision grid: expected ${cols * rows} cells, got ${obstacleGids.length}`);
  }
  return { cols, rows, tileSize, solid: obstacleGids.map((gid) => gid !== 0) };
}

/** Cell lookup; anything outside the map counts as solid. */
export function isSolidAtCell(grid: CollisionGrid, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return true;
  return grid.solid[cy * grid.cols + cx] ?? true;
}

/** True when an axis-aligned box (center x/y, half extents) overlaps no solid cell. */
export function isBoxFree(grid: CollisionGrid, x: number, y: number, half: number): boolean {
  const t = grid.tileSize;
  const x1 = Math.floor((x - half) / t);
  const x2 = Math.floor((x + half - 1e-7) / t);
  const y1 = Math.floor((y - half) / t);
  const y2 = Math.floor((y + half - 1e-7) / t);
  for (let cy = y1; cy <= y2; cy++) {
    for (let cx = x1; cx <= x2; cx++) {
      if (isSolidAtCell(grid, cx, cy)) return false;
    }
  }
  return true;
}

/**
 * Collision-aware movement integration: like `stepPosition`, but each axis is
 * resolved independently so walking diagonally into a wall slides along it
 * instead of stopping dead. Pure — the server runs it authoritatively and the
 * client runs the SAME function for prediction, so the two never disagree.
 *
 * `half` is the entity's half-extent in world units (a 24px square body by
 * default — small enough to fit one-tile doorways with room to steer).
 */
export function stepWithCollision(
  pos: Vec2,
  dir: MoveDir,
  dtSeconds: number,
  speed: number,
  grid: CollisionGrid,
  half = 12,
): Vec2 {
  let { dx, dy } = dir;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }

  const maxX = grid.cols * grid.tileSize - half;
  const maxY = grid.rows * grid.tileSize - half;
  const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

  let x = pos.x;
  let y = pos.y;

  const targetX = clamp(x + dx * speed * dtSeconds, half, maxX);
  if (isBoxFree(grid, targetX, y, half)) x = targetX;

  const targetY = clamp(y + dy * speed * dtSeconds, half, maxY);
  if (isBoxFree(grid, x, targetY, half)) y = targetY;

  return { x, y };
}
