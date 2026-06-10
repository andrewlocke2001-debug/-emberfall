import type { Vec2 } from "../types";

/** A movement intent. Components are expected in [-1, 1]. */
export interface MoveDir {
  dx: number;
  dy: number;
}

/** Clamp a value into the inclusive range [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Integrate `pos` by a movement intent over `dtSeconds`, clamped to the zone
 * bounds. Pure — returns a NEW position, never mutates the input.
 *
 * The server runs this authoritatively; the client runs the exact same
 * function for local prediction, so predicted and authoritative positions
 * stay in lock-step (no divergence from differing movement math).
 *
 * Diagonal input is normalized so moving diagonally is not faster than moving
 * along a single axis.
 */
export function stepPosition(
  pos: Vec2,
  dir: MoveDir,
  dtSeconds: number,
  speed: number,
  bounds: { width: number; height: number },
): Vec2 {
  let { dx, dy } = dir;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  return {
    x: clamp(pos.x + dx * speed * dtSeconds, 0, bounds.width),
    y: clamp(pos.y + dy * speed * dtSeconds, 0, bounds.height),
  };
}
