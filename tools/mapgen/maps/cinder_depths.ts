import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * Cinder Depths — the instanced dungeon under the Tanglewood ruins. 40×40,
 * carved from solid rock: a linear crawl south→north (entry hall → sentinel
 * vault → wraith gallery), with the third arena reserved for the P7.3 boss.
 * One instance per party (see server DungeonRoom); the south gate returns to
 * Tanglewood at the "depths" entry.
 */
function paint(): string[] {
  const p = new Painter(40, 40, "#"); // solid rock; rooms are carved out

  // Entry hall (south).
  p.fillRect(14, 30, 25, 37, "=");
  // Corridor to the sentinel vault.
  p.fillRect(18, 24, 21, 30, "=");
  // Sentinel vault (mid).
  p.fillRect(10, 15, 29, 24, "=");
  // Corridor to the wraith gallery.
  p.fillRect(18, 9, 21, 15, "=");
  // Wraith gallery (north) — the P7.3 boss arena opens beyond it.
  p.fillRect(8, 3, 31, 9, "=");

  // Trash pulls (placeholder until the P7.3 bosses land).
  p.set(14, 20, "r");
  p.set(25, 19, "r");
  p.set(12, 6, "m");
  p.set(27, 6, "m");

  // South gate back to Tanglewood + the arrival pad just inside.
  p.fillRect(19, 38, 20, 39, "X");
  p.set(19, 35, "s");

  return p.rows();
}

export const cinderDepths: MapSource = {
  id: "cinder_depths",
  displayName: "Cinder Depths",
  exits: { X: { to: "tanglewood", entry: "depths" } },
  entries: {},
  ascii: paint(),
};
