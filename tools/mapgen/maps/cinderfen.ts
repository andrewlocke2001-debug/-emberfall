import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Cinderfen — level 30–38 steam-fen scar east of the Dolmholt (WORLD.md
 * Phase 3, zone 7). 60×60 tiles.
 *
 * A wetland the shard-fire hit: pools that steam, reeds gone to glass, and
 * warm rain at night the tenders say is the Ember dreaming. The GLASS
 * WILLOW — a giant tree vitrified mid-sway — stands at the fen's heart with
 * a walk-in hollow. The Tendfast's tending-camp works the south-west; the
 * Order's sealed BLEEDWORKS squats in the north-east, pumping liquid cinder
 * out of the wound (its intake becomes the dungeon in a later slice).
 */
function paint(): string[] {
  const p = new Painter(60, 60, ".");

  // Reed-wall border, two thick.
  p.outlineRect(0, 0, 59, 59, "T");
  p.outlineRect(1, 1, 58, 58, "T");

  // West gate (to the Dolmholt) + the duckboard road east into the fen.
  p.fillRect(0, 29, 1, 30, "X");
  p.hline(2, 44, 29, ",").hline(2, 44, 30, ",");
  // Spur north to the Bleedworks; spur south to the tending-camp.
  p.vline(38, 14, 29, ",").vline(39, 14, 29, ",");
  p.vline(16, 30, 44, ",").vline(17, 30, 44, ",");

  // Steaming pools — the fen's water, scattered and warm.
  p.fillRect(6, 8, 13, 12, "~");
  p.fillRect(22, 20, 28, 24, "~");
  p.fillRect(44, 34, 52, 39, "~");
  p.fillRect(8, 48, 15, 52, "~");
  p.fillRect(30, 44, 36, 47, "~");
  p.fillRect(48, 8, 54, 11, "~");

  // The Glass Willow: vitrified mid-sway, with a hollow you can stand in.
  p.fillRect(26, 10, 33, 16, "#");
  p.fillRect(29, 14, 30, 17, "=");

  // The Bleedworks (sealed; the Order's pumps thud under the ground here).
  p.fillRect(44, 16, 54, 22, "#");
  p.fillRect(46, 18, 52, 20, "=");
  p.fillRect(44, 19, 44, 19, "="); // the intake valve — three flags, one door

  // The tending-camp: duckboard floors behind a windbreak fence.
  p.fillRect(12, 46, 21, 51, "=");
  p.hline(11, 22, 45, "f");
  p.set(16, 45, "="); // the camp gate

  // Glass reeds in brakes.
  for (const [x, y] of [
    [18, 8], [36, 8], [10, 20], [32, 26], [54, 28], [42, 44],
    [24, 40], [50, 46], [6, 36], [56, 40], [20, 14], [44, 6],
  ] as const) {
    p.set(x, y, "T");
  }

  // The fen's trouble: creepers in the shallows, stalkers in the reeds,
  // enforcers guarding the Order's pumps.
  p.set(20, 26, "n");
  p.set(12, 32, "n");
  p.set(34, 42, "n");
  p.set(30, 20, "y");
  p.set(14, 14, "y");
  p.set(40, 36, "y");
  p.set(46, 24, "j");
  p.set(50, 14, "j");

  // West entry (arrivals from the Dolmholt) + default spawn on the road.
  p.set(4, 29, "1");
  p.set(6, 31, "s");

  return p.rows();
}

export const cinderfen: MapSource = {
  id: "cinderfen",
  displayName: "The Cinderfen",
  exits: {
    X: { to: "dolmholt", entry: "east" },
  },
  entries: { "1": "west" },
  ascii: paint(),
};
