import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Emberheart Caldera — level 52–60, the WOUND ITSELF (WORLD.md Phase 3,
 * zone 12; the final zone of the 1–60 path). 60×60 tiles.
 *
 * Where the heart of the Ember came down. The WOUND-COLUMN — the standing
 * shaft of ember-light where the sky burned — rises from a lava ring at the
 * caldera's center; the Molten Throne raid descends beside it. The LAST
 * CAMP by the south gate is the only neutral fire in the caldera, and the
 * most broken truce in Vesper. Compasses don't spin here — they warm, and
 * point down.
 *
 * Three ways in: up from the Ashreach (south), across from the Kindlecourt
 * (west), and back out of the Throne itself.
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // The caldera rim, two thick.
  p.outlineRect(0, 0, 59, 59, "#");
  p.outlineRect(1, 1, 58, 58, "#");

  // South gate (from the Ashreach) + the pilgrim road north to the Wound.
  p.fillRect(29, 58, 30, 59, "X");
  p.vline(29, 24, 57, ",").vline(30, 24, 57, ",");
  // West gate (from the Kindlecourt) + its road to the junction.
  p.fillRect(0, 29, 1, 30, "C");
  p.hline(2, 29, 29, ",").hline(2, 29, 30, ",");

  // The Wound-column: a blinding shaft in a lava ring. The core is solid
  // light (impassable); the ring seethes around it.
  p.fillRect(24, 10, 35, 19, "~");
  p.fillRect(27, 13, 32, 16, "#");
  // The Molten Throne gate on the wound's west lip + its return pad.
  p.vline(21, 14, 23, ",").vline(22, 14, 23, ",");
  p.fillRect(21, 12, 22, 13, "R");
  p.set(20, 16, "3");

  // The Last Camp: the one neutral fire, ringed by a windbreak.
  p.fillRect(24, 50, 35, 55, "=");
  p.hline(23, 36, 49, "f");
  p.set(29, 49, "=").set(30, 49, "=");

  // Lava pools and scorched outcrops across the floor.
  p.fillRect(8, 8, 14, 12, "~");
  p.fillRect(44, 12, 52, 16, "~");
  p.fillRect(10, 38, 16, 42, "~");
  p.fillRect(44, 40, 50, 45, "~");
  p.fillRect(6, 22, 10, 26, "#");
  p.fillRect(48, 24, 54, 28, "#");
  p.fillRect(16, 30, 22, 33, "#");
  p.fillRect(38, 32, 44, 35, "#");

  // Charred snags.
  for (const [x, y] of [
    [18, 6], [42, 6], [6, 34], [54, 34], [14, 48], [46, 50],
    [36, 24], [12, 18], [50, 20], [22, 42],
  ] as const) {
    p.set(x, y, "T");
  }

  // The Wound's population: husks stagger the floor, wraiths orbit the
  // column, and the Throne's heralds keep the pilgrim road.
  p.set(12, 14, "H");
  p.set(46, 18, "H");
  p.set(14, 40, "H");
  p.set(44, 38, "H");
  p.set(26, 21, "Y");
  p.set(33, 21, "Y");
  p.set(38, 14, "Y");
  p.set(29, 34, "J");
  p.set(31, 42, "J");

  // South entry (from the Ashreach) at the camp + default spawn inside it.
  p.set(29, 56, "1");
  // West entry (from the Kindlecourt).
  p.set(4, 29, "2");
  p.set(28, 52, "s");

  return p.rows();
}

export const emberheartCaldera: MapSource = {
  id: "emberheart_caldera",
  displayName: "The Emberheart Caldera",
  exits: {
    X: { to: "ashreach", entry: "throne" },
    C: { to: "kindlecourt", entry: "east" },
    R: { to: "molten_throne", entry: "default" },
  },
  entries: { "1": "south", "2": "west", "3": "gate" },
  ascii: paint(),
};
