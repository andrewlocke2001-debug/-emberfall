import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Vossmere — level 18–26 drowned estuary south of Tanglewood (WORLD.md
 * Phase 3, zone 5). 60×60 tiles.
 *
 * Vossari country: the land slumps into a cold sea whose southern reach is
 * held by the OAR WALL — the breakwater of ancient oars and keels, black
 * with age, never repaired and never allowed to fall (a pure landmark; it
 * stands in open water). A stilt-city platform juts into the shallows with
 * plank bridges out to the salvage flats where the wrecks — and the
 * wreck-pickers — wait. Quenchclaw crabs chew the pilings, salt-shades walk
 * the flats, and looters work the tide line.
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Tree border (thins toward the water, but stays two thick to contain).
  p.outlineRect(0, 0, 59, 59, "T");
  p.outlineRect(1, 1, 58, 58, "T");

  // North gate (to Tanglewood) + the shore road running down to the city.
  p.fillRect(29, 0, 30, 1, "X");
  p.vline(29, 2, 40, ",").vline(30, 2, 40, ",");

  // The sea claims the south — and the Oar Wall stands in it, unreachable.
  p.fillRect(2, 44, 57, 57, "~");
  p.hline(6, 53, 52, "#").hline(6, 53, 53, "#");
  p.fillRect(28, 52, 29, 53, "~"); // the one breach nobody discusses

  // The stilt-city: a plank platform over the shallows, house-hulks west.
  p.fillRect(24, 40, 35, 47, "=");
  p.fillRect(20, 42, 23, 45, "=");
  p.set(20, 42, "#").set(23, 42, "#"); // hull ribs of the oldest house-boat

  // Plank bridges out to the salvage flats.
  p.hline(14, 23, 47, "=");
  p.hline(36, 42, 46, "=");

  // The salvage flats: tide-bared ground among the wrecks.
  p.fillRect(8, 46, 13, 49, ",");
  p.fillRect(42, 45, 47, 48, ",");

  // Scattered pines on the higher ground.
  for (const [x, y] of [
    [8, 10], [14, 16], [46, 8], [52, 16], [6, 30], [54, 30],
    [18, 24], [40, 22], [12, 36], [48, 34], [22, 12], [36, 30],
  ] as const) {
    p.set(x, y, "T");
  }

  // The zone's trouble: crabs at the tide line, shades on the flats,
  // looters working the wrecks.
  p.set(10, 43, "c");
  p.set(17, 43, "c");
  p.set(33, 43, "c");
  p.set(48, 43, "c");
  p.set(10, 47, "h");
  p.set(12, 48, "h");
  p.set(44, 46, "h");
  p.set(43, 47, "L");
  p.set(45, 45, "L");
  p.set(50, 42, "L");

  // North entry (arrivals from Tanglewood) + default spawn on the road.
  p.set(29, 3, "1");
  p.set(31, 18, "s");

  return p.rows();
}

export const vossmere: MapSource = {
  id: "vossmere",
  displayName: "The Vossmere",
  exits: {
    X: { to: "tanglewood", entry: "south" },
  },
  entries: { "1": "north" },
  ascii: paint(),
};
