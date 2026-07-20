import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Refused Column — the instanced barrow-road under Marrowgate's walls
 * (P14.2; WORLD.md zone 3's dungeon). 30×50, carved from chalk and old
 * timber: the refugee column the town refused queued here out of the cold a
 * century ago, and it is still queuing. Linear crawl south→north: entry
 * hall → the Long Queue → the wardens' vigil → the Gatewright's door.
 * Entered through the opened barrow in the Downs' south-west; one instance
 * per party.
 */
function paint(): string[] {
  const p = new Painter(30, 50, "#"); // solid chalk; the road is carved out

  // Entry hall (south) — where the barrow lets you down onto the road.
  p.fillRect(11, 40, 19, 46, "=");
  // The Long Queue — a wide gallery where the wanderers still shuffle north.
  p.fillRect(13, 34, 16, 40, "=");
  p.fillRect(7, 26, 22, 34, "=");
  // The wardens' vigil.
  p.fillRect(13, 20, 16, 26, "=");
  p.fillRect(9, 12, 20, 20, "=");
  // The Gatewright's door — the boss chamber, right under the barred gates.
  p.fillRect(13, 8, 16, 12, "=");
  p.fillRect(6, 2, 23, 8, "=");

  // The queue, in order of patience.
  p.set(9, 31, "p");
  p.set(19, 30, "p");
  p.set(11, 28, "u");
  p.set(18, 27, "u");
  p.set(14, 26, "u");
  p.set(11, 17, "g");
  p.set(18, 15, "g");
  p.set(14, 13, "u");
  p.set(14, 4, "K"); // the Gatewright — who barred the doors, and stayed
  p.set(9, 5, "p");
  p.set(20, 5, "p");

  // South gate back up to the Downs + the arrival pad inside the hall.
  p.fillRect(14, 47, 15, 49, "X");
  p.set(14, 44, "s");
  p.set(16, 43, "1");

  return p.rows();
}

export const refusedColumn: MapSource = {
  id: "refused_column",
  displayName: "The Refused Column",
  exits: {
    X: { to: "marrowgate_downs", entry: "barrow" },
  },
  entries: { "1": "gate" },
  ascii: paint(),
};
