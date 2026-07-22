import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Sunken Pyre — the instanced wreck-reef under the Vossmere's salvage
 * flats (P17.1; WORLD.md zone 5's dungeon). 30×50, carved from fused hulls:
 * the burned refugee flotilla the Oar Wall refused, driven under and grown
 * together into a reef. The fleet's guilt, walkable. Linear crawl
 * south→north: the barnacled hatch → the listing hold → the fused decks →
 * the pyre heart, where the Admiral who ordered the oars out still stands
 * his watch. One instance per party; the hatch returns to the flats.
 */
function paint(): string[] {
  const p = new Painter(30, 50, "#"); // solid reef; the decks are carved out

  // The hatch hall (south) — where the flats let you down into the wreck.
  p.fillRect(11, 40, 19, 46, "=");
  // The listing hold — a long tilted gallery, shades adrift between ribs.
  p.fillRect(13, 34, 16, 40, "=");
  p.fillRect(7, 26, 22, 34, "=");
  // Hull ribs jutting through the hold floor.
  p.set(10, 28, "#");
  p.set(19, 29, "#");
  p.set(12, 32, "#");
  // The fused decks — two ships grown into one room.
  p.fillRect(13, 20, 16, 26, "=");
  p.fillRect(9, 12, 20, 20, "=");
  p.set(14, 16, "#"); // the shared mast, fused at the join
  // The pyre heart — the Admiral's deck, where the burning never finished.
  p.fillRect(13, 8, 16, 12, "=");
  p.fillRect(6, 2, 23, 8, "=");

  // The drowned crew, in order of rank.
  p.set(9, 30, "c");
  p.set(20, 31, "c");
  p.set(11, 27, "h");
  p.set(18, 27, "h");
  p.set(11, 18, "h");
  p.set(18, 17, "h");
  p.set(14, 14, "c");
  p.set(14, 4, "Q"); // the Pyre Admiral — who ordered the oars out, and stayed
  p.set(9, 5, "h");
  p.set(20, 5, "h");

  // South hatch back up to the flats + the arrival pad inside the hall.
  p.fillRect(14, 47, 15, 49, "X");
  p.set(14, 44, "s");
  p.set(16, 43, "1");

  return p.rows();
}

export const sunkenPyre: MapSource = {
  id: "sunken_pyre",
  displayName: "The Sunken Pyre",
  exits: {
    X: { to: "vossmere", entry: "flats" },
  },
  entries: { "1": "gate" },
  ascii: paint(),
};
