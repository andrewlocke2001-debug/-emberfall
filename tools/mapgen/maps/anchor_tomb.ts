import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Anchor-Tomb — the Vossari sea-funeral ground (P18.2; the Greatwake
 * Isles' dungeon, and the last door in WORLD.md). 30×50, under the tomb
 * mound on the south-east islet. The Vossari bury their dead in the keels
 * that carried them, hauled below at slack tide; the Unreturned walk the
 * keels asking after the tide, and the HARBOR-SAINT — the first of them,
 * who set the anchor a hundred years ago — still hauls the chain. One keel
 * down here carries the same maker's mark as the black Beacon. 2 of 9.
 */
function paint(): string[] {
  const p = new Painter(30, 50, "#"); // the tomb; the sea is in the walls

  // The tide door — the entry hall under the mound.
  p.fillRect(11, 42, 18, 47, "=");
  // The stair down into the keel gallery.
  p.fillRect(13, 40, 16, 42, "=");
  // The keel gallery — funeral hulls beached in rows.
  p.fillRect(6, 30, 23, 40, "=");
  p.hline(8, 13, 33, "#");
  p.hline(16, 21, 33, "#");
  p.hline(8, 13, 36, "#");
  p.hline(16, 21, 36, "#");
  // The stair into the wet vault.
  p.fillRect(13, 28, 16, 30, "=");
  // The wet vault — the tide still comes this far, twice a day.
  p.fillRect(7, 18, 22, 28, "=");
  p.fillRect(9, 21, 13, 24, "~");
  p.fillRect(17, 22, 20, 25, "~");
  // The last approach, and the anchor court.
  p.fillRect(13, 10, 16, 18, "=");
  p.fillRect(5, 2, 24, 10, "=");

  // The Unreturned, walking the keels; whelps where the water stands.
  p.set(10, 44, "P");
  p.set(9, 32, "P");
  p.set(19, 38, "P");
  p.set(11, 26, "P");
  p.set(20, 20, "P");
  p.set(15, 25, "V");
  p.set(19, 26, "V");
  p.set(14, 5, "F"); // the Harbor-Saint, at the anchor

  // South door back up to the islet + the arrival pad in the hall.
  p.fillRect(14, 47, 15, 49, "X");
  p.set(13, 44, "s");
  p.set(16, 45, "1");

  return p.rows();
}

export const anchorTomb: MapSource = {
  id: "anchor_tomb",
  displayName: "The Anchor-Tomb",
  exits: {
    X: { to: "greatwake_isles", entry: "tomb" },
  },
  entries: { "1": "gate" },
  ascii: paint(),
};
