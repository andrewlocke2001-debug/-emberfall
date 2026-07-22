import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Graywastes — level 44–52 frost steppe east of the Ashreach (WORLD.md
 * Phase 3, zone 10). 60×60 tiles. The Long Cooling's preview: nobody holds
 * this land; cache expeditions race each other and the cold.
 *
 * The landmark is the COLD BEACON — a pre-Fall lamp-tower on the northern
 * rise that burns BLACK, casting shade at noon (mystery seed; never
 * explained). The Shepherd's congregation of Unreturned drifts around its
 * base. Dead homesteads dot the steppe with their doors standing open — the
 * last owners left them so, for whoever came after.
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Ice-rock rim, two thick.
  p.outlineRect(0, 0, 59, 59, "#");
  p.outlineRect(1, 1, 58, 58, "#");

  // West gate (from the Ashreach) + the expedition trail east then north.
  p.fillRect(0, 29, 1, 30, "X");
  p.hline(2, 30, 29, ",").hline(2, 30, 30, ",");
  p.vline(30, 12, 29, ",").vline(31, 12, 29, ",");

  // The Cold Beacon: a black lamp-tower on the northern rise, with a step
  // you can walk up to — and a door that has not opened in a century.
  p.fillRect(26, 4, 35, 11, "#");
  p.fillRect(30, 9, 31, 12, "=");

  // Dead homesteads — every door stands open (a gap in each wall ring).
  for (const [hx, hy] of [
    [10, 14], [44, 16], [12, 40], [40, 42], [22, 48], [48, 30],
  ] as const) {
    p.fillRect(hx, hy, hx + 4, hy + 3, "#");
    p.fillRect(hx + 1, hy + 1, hx + 3, hy + 2, "=");
    p.set(hx + 2, hy + 3, "="); // the open door
  }

  // The hot spring — the one warmth left, and the trout know it.
  p.fillRect(46, 50, 52, 54, "~");

  // Cache camps: bared ground where the expeditions dig.
  p.fillRect(8, 26, 12, 29, ",");
  p.fillRect(44, 24, 48, 27, ",");

  // Sparse dead pines.
  for (const [x, y] of [
    [18, 8], [48, 8], [6, 20], [54, 20], [16, 34], [36, 34],
    [8, 50], [32, 54], [54, 44], [24, 20], [40, 50], [14, 22],
  ] as const) {
    p.set(x, y, "T");
  }

  // The cold's population: wights haunt the homesteads, reavers work the
  // cache camps, and the congregation rings the Beacon.
  p.set(12, 16, "z");
  p.set(42, 18, "z");
  p.set(14, 42, "z");
  p.set(38, 44, "z");
  p.set(10, 28, "v");
  p.set(46, 25, "v");
  p.set(24, 50, "v");
  p.set(28, 8, "G");
  p.set(33, 8, "G");
  p.set(30, 14, "G");

  // West entry (arrivals from the Ashreach) + default spawn at the camp.
  p.set(4, 29, "1");
  p.set(6, 31, "s");

  return p.rows();
}

export const graywastes: MapSource = {
  id: "graywastes",
  displayName: "The Graywastes",
  exits: {
    X: { to: "ashreach", entry: "east" },
  },
  entries: { "1": "west" },
  ascii: paint(),
};
