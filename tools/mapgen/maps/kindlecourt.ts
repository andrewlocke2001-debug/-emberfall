import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Kindlecourt — level 48–56 shattered capital south of the Graywastes
 * (WORLD.md Phase 3, zone 11). 60×60 tiles.
 *
 * The Accord's capital province, where all three factions' endgames
 * converge. The landmark is the SCAFFOLD OF THE EVERLASTING LAMP — the
 * city-sized, unfinished binding engine, skeletal against the Wound-light,
 * with a single breach you can walk into. The LAMPLIGHT ARCHIVE squats in
 * the north-west, sealed and still staffed (its raid-lead-in dungeon is a
 * later slice). The streets' lamp-posts all lean toward the Scaffold,
 * half-melted in one direction, like grass bent by wind.
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Broken city wall, two thick.
  p.outlineRect(0, 0, 59, 59, "#");
  p.outlineRect(1, 1, 58, 58, "#");

  // North gate (from the Graywastes) + the processional way south.
  p.fillRect(29, 0, 30, 1, "X");
  p.vline(29, 2, 28, ",").vline(30, 2, 28, ",");

  // The forum — the old civic plaza the road empties into.
  p.fillRect(22, 28, 38, 36, ",");
  // Cross-streets of cracked marble.
  p.hline(6, 22, 31, ",").hline(6, 22, 32, ",");
  p.hline(38, 43, 31, ",").hline(38, 43, 32, ",");
  p.vline(14, 33, 50, ",").vline(15, 33, 50, ",");

  // The Lamplight Archive (north-west): sealed, still staffed. A step you
  // can stand on; a door that does not acknowledge you.
  p.fillRect(8, 6, 20, 13, "#");
  p.fillRect(10, 8, 18, 11, "=");
  p.set(14, 14, "=");
  p.set(15, 14, "=");

  // The Scaffold of the Everlasting Lamp (east): city-sized, skeletal, one
  // breach in its west face letting you walk the engine floor.
  p.fillRect(44, 18, 56, 40, "#");
  p.fillRect(46, 20, 54, 38, "=");
  p.fillRect(44, 29, 45, 30, "=");

  // Ruined insulae — city blocks with their roofs gone and walls breached.
  for (const [bx, by] of [
    [8, 20], [22, 18], [8, 38], [24, 44], [36, 44],
  ] as const) {
    p.fillRect(bx, by, bx + 6, by + 4, "#");
    p.fillRect(bx + 1, by + 1, bx + 5, by + 3, "=");
    p.set(bx + 3, by + 4, "="); // the breached doorway
  }

  // The pilgrim road east (P16.3): south of the Scaffold to the Caldera.
  p.hline(16, 57, 50, ",").hline(16, 57, 51, ",");
  p.fillRect(58, 50, 59, 51, "E");
  p.set(55, 52, "2");

  // The flooded cistern (south-west).
  p.fillRect(6, 52, 12, 56, "~");

  // Leaning colonnade stumps along the processional way.
  for (const y of [6, 10, 14, 18, 22, 26] as const) {
    p.set(27, y, "#");
    p.set(32, y, "#");
  }

  // The capital's population: courtiers drift the insulae, sentinels hold
  // the forum and the Scaffold approach, wardens keep the Archive.
  p.set(10, 18, "k");
  p.set(25, 16, "k");
  p.set(10, 36, "k");
  p.set(27, 42, "k");
  p.set(26, 33, "x");
  p.set(34, 30, "x");
  p.set(42, 30, "x");
  p.set(12, 15, "a");
  p.set(17, 15, "a");
  p.set(48, 29, "a");

  // North entry (arrivals from the Graywastes) + default spawn on the way.
  p.set(29, 3, "1");
  p.set(27, 4, "s");

  return p.rows();
}

export const kindlecourt: MapSource = {
  id: "kindlecourt",
  displayName: "The Kindlecourt",
  exits: {
    X: { to: "graywastes", entry: "south" },
    E: { to: "emberheart_caldera", entry: "west" },
  },
  entries: { "1": "north", "2": "east" },
  ascii: paint(),
};
