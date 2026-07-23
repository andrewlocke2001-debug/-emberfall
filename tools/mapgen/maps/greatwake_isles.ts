import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Greatwake Isles — level 34–42 volcanic archipelago where shards struck
 * sea (WORLD.md zone 8; the Order road's detour). 60×60 tiles, mostly water.
 *
 * Cinder-pearl beds (sea-cooled cinder, stable and clean-burning) versus the
 * kindled leviathans that made the beds. The GREATWAKE itself — a boiling
 * wake-line across the strait that has not closed in a hundred years — cuts
 * the map north–south, crossable at exactly one keel-bridge. Islanders nail
 * kettles to shrine posts: a boiling offering needs no fire here. The
 * Vossari sea-funeral ground, the ANCHOR-TOMB, waits sealed on the
 * south-east islet (its door opens in a later slice).
 */
function paint(): string[] {
  const p = new Painter(60, 60, "~"); // the boiling sea

  // The islands, black-sand scrub carved from the water.
  p.fillRect(2, 24, 14, 34, ".");   // the Strait Steps (west arrival)
  p.fillRect(4, 38, 23, 54, ".");   // Hearthholm — the pearl-camp
  p.fillRect(24, 4, 38, 14, ".");   // the Kettle Rows (shrine islet)
  p.fillRect(22, 24, 40, 40, ".");  // the Pearl Beds shallows
  p.fillRect(44, 20, 57, 34, ".");  // Leviathan's Rest (east, toward Ashreach)
  p.fillRect(42, 44, 56, 55, ".");  // the Anchor-Tomb islet (sea-funeral ground)

  // Keel-bridges between the islands.
  p.hline(14, 22, 29, ",").hline(14, 22, 30, ",");   // Steps → Beds
  p.vline(10, 34, 38, ",").vline(11, 34, 38, ",");   // Steps → Hearthholm
  p.vline(22, 40, 44, ",").vline(23, 40, 44, ",");   // Beds → Hearthholm
  p.vline(30, 14, 24, ",").vline(31, 14, 24, ",");   // Kettle Rows → Beds
  p.hline(40, 44, 27, ",").hline(40, 44, 28, ",");   // Beds → Leviathan's Rest
  p.vline(50, 34, 44, ",").vline(51, 34, 44, ",");   // Rest → Anchor-Tomb

  // THE GREATWAKE: the boiling wake-line, one hundred years wide open.
  // Impassable steam-wall down the strait — the keel-bridge is the only way.
  p.vline(42, 2, 26, "#");
  p.vline(43, 2, 26, "#");
  p.vline(42, 29, 42, "#");
  p.vline(43, 29, 42, "#");
  p.vline(42, 57, 59, "#");
  p.vline(43, 57, 59, "#");

  // Volcanic outcrops on the islands.
  p.fillRect(6, 40, 9, 43, "#");
  p.fillRect(26, 26, 28, 28, "#");
  p.fillRect(52, 22, 55, 24, "#");
  p.fillRect(18, 48, 21, 50, "#");

  // The Kettle Rows: shrine posts, each with its nailed kettle.
  for (const [x, y] of [
    [26, 6], [30, 6], [34, 6], [26, 10], [30, 10], [34, 10], [37, 8],
  ] as const) {
    p.set(x, y, "T");
  }
  // Scattered shrine posts elsewhere — the habit travels.
  p.set(6, 27, "T");
  p.set(16, 44, "T");
  p.set(36, 37, "T");
  p.set(47, 31, "T");

  // The pearl-camp: duckboard floors on Hearthholm.
  p.fillRect(8, 44, 15, 50, "=");

  // The Anchor-Tomb: beached funeral keels in rows, and the sealed door.
  p.hline(45, 50, 47, "#");
  p.hline(45, 50, 50, "#");
  p.hline(45, 50, 53, "#");
  p.fillRect(52, 48, 55, 52, "#"); // the tomb mound
  p.set(53, 52, "C"); // the tomb door — open at last (P18.2)
  p.set(54, 52, "C");
  p.set(52, 54, "3");

  // The trouble: wakespawn in the beds, shades on the keels, whelps east.
  p.set(26, 32, "M");
  p.set(34, 28, "M");
  p.set(28, 38, "M");
  p.set(37, 34, "M");
  p.set(45, 48, "P");
  p.set(49, 54, "P");
  p.set(47, 45, "P");
  p.set(47, 24, "V");
  p.set(52, 30, "V");
  p.set(55, 30, "V");

  // West gate to the Cinderfen; east gate to the Ashreach.
  p.fillRect(0, 29, 1, 30, "X");
  p.hline(2, 13, 29, ",").hline(2, 13, 30, ",");
  p.fillRect(58, 26, 59, 27, "S");
  p.hline(52, 57, 26, ",").hline(52, 57, 27, ",");

  // Entries + default spawn on the Strait Steps.
  p.set(4, 29, "1");
  p.set(55, 28, "2");
  p.set(6, 31, "s");

  return p.rows();
}

export const greatwakeIsles: MapSource = {
  id: "greatwake_isles",
  displayName: "The Greatwake Isles",
  exits: {
    X: { to: "cinderfen", entry: "east" },
    S: { to: "ashreach", entry: "west" },
    C: { to: "anchor_tomb", entry: "gate" },
  },
  entries: { "1": "west", "2": "east", "3": "tomb" },
  ascii: paint(),
};
