/**
 * Map authoring types for the ASCII → Tiled-JSON generator.
 *
 * Legend (one char per tile):
 *   .  grass            ,  path / plaza
 *   #  wall (solid)     T  tree (solid)
 *   ~  water (solid)    =  wood floor
 *   f  fence (solid)    s  default spawn point (grass)
 *   D  training dummy spawn (grass)
 *   E  exit tile (path; which exit it is comes from MapSource.exits)
 *   0-9 entry points (path; named via MapSource.entries)
 */

export const GROUND_CHARS = [".", ",", "=", "s", "D", "E", "~"] as const;

export interface ExitDef {
  /** Target zone id. */
  to: string;
  /** Entry-point name in the target zone to spawn at. */
  entry: string;
}

export interface MapSource {
  /** Zone id — becomes the .json filename and the room's zoneId. */
  id: string;
  displayName: string;
  /** Rectangular character grid; every row must be the same length. */
  ascii: string[];
  /** Exit char → where it leads. All maps here use `E`; more chars allowed. */
  exits: Record<string, ExitDef>;
  /** Digit char → entry-point name (where travellers appear). */
  entries: Record<string, string>;
}
