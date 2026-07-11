import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * Tanglewood — the level 20–40 forest east of Greenreach. 60×60 tiles.
 *
 * An overgrown Accord province: dense tree walls carve the map into winding
 * corridors and clearings. Thorn Stalkers prowl the west woods, Ruin Sentinels
 * guard the old ruins in the east, and Ember Wraiths drift through the south
 * grove. Iron rocks + a trout pool reward venturing deep (nodes are data in
 * shared/data/resources.ts). West gate (rows 29–30) back to Greenreach; the
 * Cinder Depths entrance arrives with P7.2.
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Deep forest border, two trees thick.
  p.outlineRect(0, 0, 59, 59, "T");
  p.outlineRect(1, 1, 58, 58, "T");

  // West gate (rows 29–30) + the old road winding east.
  p.hline(2, 34, 29, ",").hline(2, 34, 30, ",");
  p.fillRect(0, 29, 1, 30, "X");
  // North fork to the iron glade; south fork to the wraith grove.
  p.vline(26, 12, 29, ",").vline(27, 12, 29, ",");
  p.vline(30, 30, 46, ",").vline(31, 30, 46, ",");
  // East spur into the ruins.
  p.hline(34, 48, 27, ",").hline(34, 48, 28, ",");

  // Dense interior thickets — Tanglewood is corridors, not open fields.
  p.fillRect(8, 6, 20, 9, "T");
  p.fillRect(34, 6, 44, 10, "T");
  p.fillRect(6, 14, 14, 20, "T");
  p.fillRect(34, 14, 40, 22, "T");
  p.fillRect(6, 36, 16, 42, "T");
  p.fillRect(20, 36, 26, 40, "T");
  p.fillRect(38, 36, 44, 42, "T");
  p.fillRect(12, 48, 22, 52, "T");
  p.fillRect(48, 48, 54, 52, "T");
  p.fillRect(50, 12, 55, 20, "T");

  // The old ruins (east): broken walls the sentinels still patrol.
  p.fillRect(44, 24, 52, 25, "#");
  p.fillRect(44, 31, 52, 32, "#");
  p.vline(44, 26, 30, "#");
  // (Gap at the east side — the road enters through rows 27–28.)

  // Wraith pond in the south grove.
  p.fillRect(44, 44, 50, 47, "~");
  p.fillRect(46, 43, 52, 46, "~");

  // Scattered lone trees to break sightlines.
  for (const [x, y] of [
    [22, 20],
    [18, 26],
    [24, 33],
    [36, 33],
    [16, 33],
    [42, 18],
    [28, 8],
    [8, 26],
    [54, 36],
    [36, 46],
    [26, 46],
    [8, 46],
    [54, 8],
    [30, 24],
  ] as const) {
    p.set(x, y, "T");
  }

  // Mobs: stalkers prowl the west road, sentinels hold the ruins, wraiths
  // drift the south grove near the pond.
  p.set(14, 28, "t");
  p.set(20, 31, "t");
  p.set(25, 16, "t");
  p.set(28, 14, "t");
  p.set(46, 27, "r");
  p.set(49, 29, "r");
  p.set(47, 30, "r");
  p.set(34, 44, "m");
  p.set(37, 47, "m");
  p.set(42, 49, "m");

  // The Cinder Depths gate inside the ruins (east), with the return entry
  // just outside it on the road.
  p.set(51, 27, "C");
  p.set(51, 28, "C");
  p.set(48, 28, "2");

  // North gate to the Ashreach (P9 risk zone) + its return entry. The north
  // fork road (x26-27) is extended to the border.
  p.vline(26, 2, 12, ",").vline(27, 2, 12, ",");
  p.fillRect(26, 0, 27, 1, "A");
  p.set(26, 4, "3");

  // West entry (arrivals from Greenreach) + default spawn just inside.
  p.set(4, 29, "1");
  p.set(6, 31, "s");

  return p.rows();
}

export const tanglewood: MapSource = {
  id: "tanglewood",
  displayName: "Tanglewood",
  exits: {
    X: { to: "greenreach", entry: "east" },
    C: { to: "cinder_depths", entry: "default" },
    A: { to: "ashreach", entry: "south" },
  },
  entries: { "1": "west", "2": "depths", "3": "ash" },
  ascii: paint(),
};
