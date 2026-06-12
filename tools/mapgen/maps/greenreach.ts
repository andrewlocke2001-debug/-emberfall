import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * Greenreach — level 1–20 fields east of Meadowbrook. 60×60 tiles.
 *
 * Open meadows ringed by deep forest, a dirt road running east from the west
 * gate (rows 29–30), a lake, several copses, and training dummies standing in
 * for the P2 mob camps (their spawn markers already use the object layer the
 * mob system will read).
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Deep forest border, two trees thick.
  p.outlineRect(0, 0, 59, 59, "T");
  p.outlineRect(1, 1, 58, 58, "T");

  // West gate breaching the forest at rows 29–30, road heading east.
  p.hline(2, 41, 29, ",").hline(2, 41, 30, ",");
  p.fillRect(0, 29, 1, 30, "E");
  // Road forks: north to the dummy glade, south toward the lake meadow.
  p.vline(40, 18, 29, ",").vline(41, 18, 29, ",");
  p.vline(40, 30, 44, ",").vline(41, 30, 44, ",");

  // Lake (south-east).
  p.fillRect(44, 38, 53, 44, "~");
  p.fillRect(42, 40, 55, 42, "~");
  p.fillRect(46, 36, 51, 46, "~");

  // Copses — clusters of trees through the meadows.
  p.fillRect(8, 8, 12, 10, "T");
  p.fillRect(20, 12, 22, 13, "T");
  p.fillRect(10, 40, 13, 43, "T");
  p.fillRect(28, 48, 31, 50, "T");
  p.fillRect(48, 8, 52, 11, "T");
  for (const [x, y] of [
    [16, 22],
    [25, 36],
    [34, 14],
    [44, 22],
    [7, 26],
    [7, 34],
    [54, 28],
    [36, 52],
    [18, 52],
    [52, 52],
    [26, 6],
    [40, 6],
  ] as const) {
    p.set(x, y, "T");
  }

  // Training dummies (P2: real mob camps replace these markers).
  p.set(36, 20, "D"); // north glade
  p.set(30, 38, "D"); // mid meadow
  p.set(50, 24, "D"); // east fields

  // West entry (arrivals from Meadowbrook) + default spawn near the gate.
  p.set(4, 29, "1");
  p.set(6, 31, "s");

  return p.rows();
}

export const greenreach: MapSource = {
  id: "greenreach",
  displayName: "Greenreach",
  exits: { E: { to: "meadowbrook", entry: "east" } },
  entries: { "1": "west" },
  ascii: paint(),
};
