import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Bleedworks — the Order's pumping station under the Cinderfen (P17.3;
 * WORLD.md zone 7's dungeon, the faction flashpoint made enterable). 30×50,
 * cut into the fen's bedrock on the bones of an Accord spa that once
 * bottled "healthful warmth." Now it draws LIQUID CINDER out of the wound —
 * the vats seethe with it. Linear crawl south→north: the intake stair →
 * the pipe gallery → the vat hall → the pump heart, where the Overseer
 * keeps the master valve turning no matter what it costs the fen above.
 */
function paint(): string[] {
  const p = new Painter(30, 50, "#"); // bedrock; the works are cut out

  // The intake stair — down from the valve on the Bleedworks' west face.
  p.fillRect(11, 42, 19, 47, "=");
  // First run of pipe.
  p.fillRect(13, 36, 16, 42, "=");
  // The pipe gallery — columns of trunk-line stacked floor to ceiling.
  p.fillRect(7, 28, 22, 36, "=");
  p.set(10, 30, "#");
  p.set(19, 30, "#");
  p.set(10, 34, "#");
  p.set(19, 34, "#");
  // Second run.
  p.fillRect(13, 22, 16, 28, "=");
  // The vat hall — open cinder seething where the spa's baths used to be.
  p.fillRect(6, 12, 23, 22, "=");
  p.fillRect(9, 14, 12, 16, "~");
  p.fillRect(17, 18, 20, 20, "~");
  // The last run, and the pump heart.
  p.fillRect(13, 8, 16, 12, "=");
  p.fillRect(6, 2, 23, 8, "=");
  p.set(7, 3, "#"); // the master valve's housing, corner-set
  p.set(22, 3, "#");

  // The works' crew: creepers boil up the stair, stalkers hunt the vats,
  // enforcers hold the deep runs for the Order.
  p.set(9, 31, "n");
  p.set(20, 32, "n");
  p.set(10, 15, "y");
  p.set(19, 19, "y");
  p.set(14, 25, "j");
  p.set(14, 10, "j");
  p.set(14, 4, "O"); // the Intake Overseer — the valve turns, whatever it costs
  p.set(9, 5, "j");

  // South stair back up to the valve + the arrival pad inside.
  p.fillRect(14, 48, 15, 49, "X");
  p.set(14, 45, "s");
  p.set(16, 44, "1");

  return p.rows();
}

export const bleedworks: MapSource = {
  id: "bleedworks",
  displayName: "The Bleedworks",
  exits: {
    X: { to: "cinderfen", entry: "intake" },
  },
  entries: { "1": "gate" },
  ascii: paint(),
};
