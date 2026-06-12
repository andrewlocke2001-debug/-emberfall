import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * Meadowbrook — the starting town of Vesper. Safe zone, 40×40 tiles.
 *
 * Tree line + fence ring, central plaza with a path cross, an inn (NW), a
 * smithy (NE), two cottages (S), a pond (E), a training dummy off the plaza,
 * and the east gate (rows 21–22) out to Greenreach.
 */
function paint(): string[] {
  const p = new Painter(40, 40, ".");

  // World edge: tree line with a fence ring just inside.
  p.outlineRect(0, 0, 39, 39, "T");
  p.outlineRect(1, 1, 38, 38, "T");
  p.outlineRect(2, 2, 37, 37, "f");

  // Plaza (center) and the path cross through it.
  p.fillRect(15, 12, 22, 17, ",");
  p.vline(18, 8, 12, ",").vline(19, 8, 12, ","); // north spur
  p.hline(7, 15, 10, ",").hline(7, 15, 11, ","); // west road
  p.hline(22, 32, 10, ",").hline(22, 32, 11, ","); // east road (upper)
  p.vline(18, 17, 29, ",").vline(19, 17, 29, ","); // south spur

  // East road to the gate (rows 21–22), gate breaches fence+trees.
  p.hline(22, 39, 21, ",").hline(22, 39, 22, ",");
  p.fillRect(38, 21, 39, 22, "E");

  // Inn (NW) and smithy (NE), doors opening toward the west/east roads.
  p.building(5, 4, 13, 9, 8);
  p.building(26, 4, 34, 9, 29);

  // Two cottages in the south.
  p.building(5, 25, 11, 29, 7);
  p.building(24, 25, 30, 29, 26);

  // Pond, east of the plaza.
  p.fillRect(28, 14, 33, 17, "~");
  p.fillRect(27, 15, 34, 16, "~");

  // Scattered trees inside the walls (kept off roads and door fronts).
  for (const [x, y] of [
    [6, 13],
    [12, 20],
    [6, 33],
    [12, 35],
    [20, 34],
    [27, 33],
    [33, 35],
    [33, 25],
    [4, 18],
  ] as const) {
    p.set(x, y, "T");
  }

  // Training dummy beside the plaza; default spawn in the plaza heart;
  // east entry just inside the gate.
  p.set(12, 14, "D");
  p.set(18, 14, "s");
  p.set(36, 21, "1");

  return p.rows();
}

export const meadowbrook: MapSource = {
  id: "meadowbrook",
  displayName: "Meadowbrook",
  exits: { E: { to: "greenreach", entry: "west" } },
  entries: { "1": "east" },
  ascii: paint(),
};
