import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Lamplight Archive — the Order's unacknowledged shame (P17.4; WORLD.md
 * zone 11's dungeon, the raid-lead-in). 30×60, behind the sealed step in the
 * Kindlecourt: the one building in the capital that is still STAFFED, and
 * the place where the forbidden discipline — Lampwrighting, the binding of
 * living heat — is practiced today. Crawl south→north: the reading hall →
 * the restricted stacks → the lamp gallery (phylactery-lamps aglow, each
 * one somebody's stolen spark) → the binding theatre, where the
 * Archivist-in-Lamplight works.
 */
function paint(): string[] {
  const p = new Painter(30, 60, "#"); // the Archive; the halls are shelved out

  // The reading hall — dusted desks, a century of diligence.
  p.fillRect(9, 50, 20, 56, "=");
  // The stair into the restricted stacks.
  p.fillRect(13, 44, 16, 50, "=");
  // The restricted stacks — shelf-walls with reading lanes between.
  p.fillRect(6, 32, 23, 44, "=");
  p.hline(8, 13, 35, "#");
  p.hline(16, 21, 35, "#");
  p.hline(8, 13, 38, "#");
  p.hline(16, 21, 38, "#");
  p.hline(8, 13, 41, "#");
  p.hline(16, 21, 41, "#");
  // The stair up into the lamp gallery.
  p.fillRect(13, 26, 16, 32, "=");
  // The lamp gallery — the collection. Every pillar carries a lit lamp.
  p.fillRect(7, 16, 22, 26, "=");
  p.set(10, 19, "#");
  p.set(19, 19, "#");
  p.set(10, 23, "#");
  p.set(19, 23, "#");
  // The last approach, and the binding theatre.
  p.fillRect(13, 10, 16, 16, "=");
  p.fillRect(5, 2, 24, 10, "=");

  // The staff, in order of clearance.
  p.set(11, 53, "k");
  p.set(14, 36, "k");
  p.set(18, 42, "k");
  p.set(14, 29, "a");
  p.set(10, 20, "a");
  p.set(19, 24, "a");
  p.set(14, 5, "U"); // Provost Ilsever, the Archivist-in-Lamplight
  p.set(8, 6, "a");
  p.set(21, 6, "a");

  // South door back out to the step + the arrival pad in the hall.
  p.fillRect(14, 57, 15, 59, "X");
  p.set(14, 54, "s");
  p.set(16, 53, "1");

  return p.rows();
}

export const lamplightArchive: MapSource = {
  id: "lamplight_archive",
  displayName: "The Lamplight Archive",
  exits: {
    X: { to: "kindlecourt", entry: "archive" },
  },
  entries: { "1": "gate" },
  ascii: paint(),
};
