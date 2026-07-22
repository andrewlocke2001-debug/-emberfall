import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Molten Throne (P12.1) — the instanced raid. A 30×70 vertical gauntlet
 * carved from volcanic rock: five arenas climbing north to the throne, linked
 * by narrow corridors. Bosses are NOT placed as markers — the raid logic
 * chain-spawns them (shared/data/raid.ts) so the gauntlet is strictly
 * sequential. South gate returns to the Ashreach.
 */
function paint(): string[] {
  const p = new Painter(30, 70, "#"); // solid rock; arenas are carved out

  // Entry hall (south), and the doorway up into the nest — this connector
  // was MISSING since P12.1 (row 63 was solid rock): players were sealed in
  // the entry and could only fight the Broodmother through the wall. Found
  // by a real play-tester; e2e always teleported past it.
  p.fillRect(11, 64, 18, 67, "=");
  p.fillRect(13, 62, 16, 64, "=");
  // Arena 1 — the Broodmother's nest.
  p.fillRect(5, 54, 24, 62, "=");
  p.fillRect(13, 50, 16, 54, "=");
  // Arena 2 — the Colossus hall.
  p.fillRect(5, 42, 24, 50, "=");
  p.fillRect(13, 38, 16, 42, "=");
  // Arena 3 — the Shade gallery.
  p.fillRect(5, 30, 24, 38, "=");
  p.fillRect(13, 26, 16, 30, "=");
  // Arena 4 — the Herald's crossing.
  p.fillRect(5, 18, 24, 26, "=");
  p.fillRect(13, 13, 16, 18, "=");
  // The throne room (north) — the Molten King.
  p.fillRect(4, 4, 25, 13, "=");

  // Ashen trash guards the climb (the bosses themselves chain-spawn).
  p.set(8, 56, "m");
  p.set(21, 44, "m");

  // South gate back to the Ashreach + arrivals just inside ('s' is the
  // default entry the gate transfer lands on).
  p.fillRect(14, 68, 15, 69, "X");
  p.set(16, 66, "s");

  return p.rows();
}

export const moltenThrone: MapSource = {
  id: "molten_throne",
  displayName: "The Molten Throne",
  exits: { X: { to: "emberheart_caldera", entry: "gate" } },
  entries: {},
  ascii: paint(),
};
