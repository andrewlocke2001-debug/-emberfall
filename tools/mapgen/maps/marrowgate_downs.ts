import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Marrowgate Downs — level 10–18 chalk barrow-country north of
 * Greenreach (WORLD.md Phase 3, zone 3). 60×60 tiles.
 *
 * The landmark is Marrowgate itself: a walled ghost town in the north whose
 * gates are barred FROM THE INSIDE — fully sealed, never enterable (its
 * barrow-road dungeon comes in P14.2). Barrow mounds dot the open downs with
 * the Unreturned drifting between them; the League's quarantine post guards
 * the road in the south. Iron is plentiful here — the zone band (10–18)
 * matches the mining requirement.
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Sparse tree border (downs, not forest) — still two thick to contain.
  p.outlineRect(0, 0, 59, 59, "T");
  p.outlineRect(1, 1, 58, 58, "T");

  // The road: south gate (to Greenreach) north to Marrowgate's sealed doors.
  p.vline(29, 30, 57, ",").vline(30, 30, 57, ",");
  p.fillRect(29, 58, 30, 59, "S");

  // Marrowgate — the sealed ghost town (rows 5–17). Double walls, roofs
  // hinted inside, and NO opening: the doors were barred a century ago.
  p.fillRect(18, 5, 42, 17, "=");
  p.outlineRect(18, 5, 42, 17, "#");
  p.outlineRect(19, 6, 41, 16, "#");
  // Inner ruins (visible over the wall top as broken blocks).
  p.fillRect(23, 9, 26, 12, "#");
  p.fillRect(30, 8, 33, 11, "#");
  p.fillRect(36, 10, 39, 13, "#");
  // The barred gatehouse: the road dead-ends into doubled wall.
  p.fillRect(28, 15, 31, 17, "#");
  p.vline(29, 18, 29, ",").vline(30, 18, 29, ",");

  // Barrow mounds — solid chalk ovals with the dead's lights drifting near.
  p.fillRect(9, 24, 12, 26, "#");
  p.fillRect(46, 22, 49, 24, "#");
  p.fillRect(12, 38, 15, 40, "#");
  p.fillRect(44, 34, 47, 36, "#");
  p.fillRect(8, 47, 10, 48, "#");
  p.fillRect(50, 44, 52, 45, "#");

  // The cold pond (south-east) — trout under still water.
  p.fillRect(44, 48, 52, 53, "~");
  p.fillRect(46, 46, 50, 54, "~");

  // The League quarantine post: fenced yard beside the road, gap to the east.
  p.outlineRect(20, 45, 27, 50, "f");
  p.fillRect(27, 47, 27, 48, ","); // the gap
  p.fillRect(21, 46, 26, 49, ",");

  // Scattered lone trees on the downs.
  for (const [x, y] of [
    [8, 12], [12, 18], [50, 10], [54, 18], [6, 32], [54, 30],
    [16, 30], [40, 28], [10, 54], [50, 56], [36, 44], [18, 42],
  ] as const) {
    p.set(x, y, "T");
  }

  // The Unreturned. Wisps haunt the barrows, wanderers walk the road's
  // edges, and two marrow-wardens flank the sealed gatehouse.
  p.set(11, 27, "p"); // wisp at the west barrow
  p.set(47, 25, "p"); // wisp at the east barrow
  p.set(13, 41, "p"); // wisp, south-west mound
  p.set(45, 37, "p"); // wisp, south-east mound
  p.set(24, 32, "u"); // wanderer, west of the road
  p.set(36, 30, "u"); // wanderer, east of the road
  p.set(20, 22, "u"); // wanderer, below the walls
  p.set(40, 21, "u"); // wanderer, below the walls
  p.set(26, 19, "g"); // marrow-warden, west of the gatehouse
  p.set(33, 19, "g"); // marrow-warden, east of the gatehouse

  // South entry (arrivals from Greenreach) + default spawn by the post.
  p.set(29, 55, "1");
  p.set(31, 53, "s");

  return p.rows();
}

export const marrowgateDowns: MapSource = {
  id: "marrowgate_downs",
  displayName: "The Marrowgate Downs",
  exits: {
    S: { to: "greenreach", entry: "north" },
  },
  entries: { "1": "south" },
  ascii: paint(),
};
