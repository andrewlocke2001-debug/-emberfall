import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Dolmholt — level 26–34 terraced mountain holds north of Tanglewood
 * (WORLD.md Phase 3, zone 6). 60×60 tiles.
 *
 * Dolm country: three rock terraces climb from the south gate to the high
 * shelf where the DOORS OF THE SEALED SHIFT stand carved into the cliff —
 * three hundred names on the inside, sealed since the fire (the dungeon
 * behind them is a later slice; you can walk into the door alcove, and no
 * further). The walled hold sits on the middle terrace with the frontier's
 * second bank; the Open-Vein's illegal pithead scars the west slope. The
 * zone is the mining capital — and the ore is why everything here fights.
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Rock rim, two thick — mountains, not forest.
  p.outlineRect(0, 0, 59, 59, "#");
  p.outlineRect(1, 1, 58, 58, "#");

  // South gate (to Tanglewood) + the stair-road climbing the terraces.
  p.fillRect(26, 58, 27, 59, "X");
  p.vline(26, 4, 57, ",").vline(27, 4, 57, ",");

  // Three terrace ridges, breached only where the road passes.
  p.hline(4, 22, 44, "#").hline(31, 55, 44, "#");
  p.hline(4, 24, 36, "#").hline(31, 55, 36, "#");
  p.hline(4, 24, 20, "#").hline(31, 55, 20, "#");

  // The fen road (P14.5): east along the middle terrace to the Cinderfen.
  p.hline(28, 57, 30, ",").hline(28, 57, 31, ",");
  p.fillRect(58, 30, 59, 31, "F");
  p.set(55, 32, "2");

  // The hold (middle terrace, east of the road): floors + corner posts.
  p.fillRect(31, 38, 42, 43, "=");
  p.set(31, 38, "#").set(42, 38, "#").set(31, 43, "#").set(42, 43, "#");

  // The Doors of the Sealed Shift: a cliff-block on the high shelf. The
  // gallery is REOPENED (P17.2) — the alcove's head is now the way down.
  p.fillRect(38, 4, 54, 12, "#");
  p.fillRect(45, 9, 46, 12, "=");
  p.fillRect(45, 9, 46, 9, "S");
  p.set(45, 13, "3");

  // The Open-Vein pithead (west slope): an illegal mine mouth in the scree.
  p.fillRect(9, 26, 12, 28, "#");

  // The tarn (east, middle terrace) — cold, deep, stocked.
  p.fillRect(44, 24, 50, 27, "~");

  // Sparse pines on the scrub.
  for (const [x, y] of [
    [8, 8], [20, 10], [32, 16], [10, 16], [54, 16], [6, 40],
    [50, 40], [16, 40], [8, 52], [46, 52], [36, 28], [18, 28],
  ] as const) {
    p.set(x, y, "T");
  }

  // The slope's trouble: hounds hunt the low terraces, cutters work the
  // pithead, and deep echoes pace the high shelf by the Doors.
  p.set(16, 48, "d");
  p.set(40, 50, "d");
  p.set(20, 30, "d");
  p.set(14, 28, "o");
  p.set(10, 31, "o");
  p.set(16, 25, "o");
  p.set(33, 16, "q");
  p.set(48, 15, "q");

  // South entry (arrivals from Tanglewood) + default spawn by the road.
  p.set(26, 55, "1");
  p.set(28, 54, "s");

  return p.rows();
}

export const dolmholt: MapSource = {
  id: "dolmholt",
  displayName: "The Dolmholt",
  exits: {
    X: { to: "tanglewood", entry: "north" },
    F: { to: "cinderfen", entry: "west" },
    S: { to: "sealed_shift", entry: "gate" },
  },
  entries: { "1": "south", "2": "east", "3": "doors" },
  ascii: paint(),
};
