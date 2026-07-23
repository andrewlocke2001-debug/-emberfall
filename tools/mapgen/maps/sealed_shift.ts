import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Sealed Shift — the reopened gallery behind the Doors (P17.2; WORLD.md
 * zone 6's dungeon). 30×50, carved from the mountain: when a gallery fire
 * threatened the hold, the doors were closed on three hundred of their own,
 * alive. The names are carved on the inside. What rekindled down there kept
 * the shift-bells — and at the DEEPEST point the drift ends at the ANSWERED
 * DOOR: a smooth, worked wall older than every era above it, which the Dolm
 * sealed again without carving a single name (expansion hook; you can stand
 * before it, and it does not answer you). Linear crawl south→north.
 */
function paint(): string[] {
  const p = new Painter(30, 50, "#"); // the mountain; the shift is carved out

  // The entry stair — down through the Doors.
  p.fillRect(11, 42, 19, 47, "=");
  // First drift.
  p.fillRect(13, 36, 16, 42, "=");
  // The bell gallery — timbered, and the bells still hung.
  p.fillRect(7, 28, 22, 36, "=");
  p.set(10, 30, "#"); // timber props
  p.set(19, 31, "#");
  p.set(12, 34, "#");
  // Second drift.
  p.fillRect(13, 22, 16, 28, "=");
  // The burned shift — the wide chamber where the fire caught them.
  p.fillRect(6, 12, 23, 22, "=");
  p.set(9, 15, "#"); // collapsed props, ore glinting in the scorch
  p.set(20, 14, "#");
  p.set(11, 19, "#");
  p.set(18, 20, "#");
  // The last drift, and the foreman's face.
  p.fillRect(13, 8, 16, 12, "=");
  p.fillRect(6, 2, 23, 8, "=");
  // Beyond the arena's north wall: the Answered Door. Sealed. It stays so.

  // What the fire left, in order of depth.
  p.set(9, 31, "d");
  p.set(20, 32, "d");
  p.set(11, 25, "q");
  p.set(9, 14, "q");
  p.set(19, 16, "q");
  p.set(14, 19, "q");
  p.set(14, 4, "Z"); // the Bell-Foreman — who kept the shift, and keeps it
  p.set(9, 5, "q");
  p.set(20, 5, "q");

  // South stair back up through the Doors + the arrival pad inside.
  p.fillRect(14, 48, 15, 49, "X");
  p.set(14, 45, "s");
  p.set(16, 44, "1");

  return p.rows();
}

export const sealedShift: MapSource = {
  id: "sealed_shift",
  displayName: "The Sealed Shift",
  exits: {
    X: { to: "dolmholt", entry: "doors" },
  },
  entries: { "1": "gate" },
  ascii: paint(),
};
