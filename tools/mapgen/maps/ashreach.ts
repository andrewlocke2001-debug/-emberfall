import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The Ashreach — the opt-in PvP risk zone (P9). 50×50 scorched uplands north
 * of Tanglewood: the best resource density in the game, prowled by the
 * toughest overworld mobs, and open PvP (see PVP_ZONES). Death here drops
 * your most valuable items + coins. South gate back to Tanglewood.
 */
function paint(): string[] {
  const p = new Painter(50, 50, ".");

  // Blasted rock border, two thick.
  p.outlineRect(0, 0, 49, 49, "#");
  p.outlineRect(1, 1, 48, 48, "#");

  // A scorched road north from the gate into the caldera.
  p.vline(24, 30, 47, ",").vline(25, 30, 47, ",");
  p.fillRect(10, 12, 39, 29, "."); // open caldera (kept clear)

  // Rock outcrops.
  p.fillRect(8, 6, 16, 9, "#");
  p.fillRect(32, 5, 42, 8, "#");
  p.fillRect(6, 20, 10, 30, "#");
  p.fillRect(40, 18, 44, 28, "#");
  p.fillRect(14, 36, 20, 40, "#");
  p.fillRect(32, 38, 38, 42, "#");

  // Cinder pools (rendered as water).
  p.fillRect(18, 16, 23, 19, "~");
  p.fillRect(30, 24, 35, 27, "~");

  // The toughest overworld spawns, dense.
  p.set(16, 14, "m");
  p.set(28, 13, "m");
  p.set(36, 21, "m");
  p.set(20, 26, "m");
  p.set(13, 22, "b");
  p.set(30, 30, "b");
  p.set(38, 12, "r");
  p.set(12, 32, "r");

  // South gate back to Tanglewood + arrivals just inside.
  p.fillRect(24, 48, 25, 49, "X");
  p.set(24, 46, "1");
  p.set(26, 46, "s");

  return p.rows();
}

export const ashreach: MapSource = {
  id: "ashreach",
  displayName: "The Ashreach",
  exits: { X: { to: "tanglewood", entry: "ash" } },
  entries: { "1": "south" },
  ascii: paint(),
};
