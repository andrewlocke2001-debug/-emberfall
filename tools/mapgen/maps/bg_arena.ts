import { Painter } from "../paint";
import type { MapSource } from "../types";

/**
 * The battleground arena (P12.2) — a 30×30 symmetric team-PvP bowl. Red spawns
 * NW, Blue spawns SE, four pillars break sightlines. Entry is by QUEUE only
 * (the matchmaker mints the instance ticket); the south gate lets a player
 * leave the match early, back to town.
 */
function paint(): string[] {
  const p = new Painter(30, 30, "#");

  // The bowl.
  p.fillRect(2, 2, 27, 27, "=");

  // Four symmetric pillars.
  p.fillRect(9, 9, 11, 11, "#");
  p.fillRect(18, 9, 20, 11, "#");
  p.fillRect(9, 18, 11, 20, "#");
  p.fillRect(18, 18, 20, 20, "#");

  // Team corners.
  p.set(4, 4, "1"); // red
  p.set(25, 25, "2"); // blue

  // A practice dummy tucked in the NE corner (also the map-contract mob).
  p.set(26, 3, "D");

  // Default spawn + the leave gate (south).
  p.set(15, 26, "s");
  p.fillRect(14, 28, 15, 29, "X");

  return p.rows();
}

export const bgArena: MapSource = {
  id: "bg_arena",
  displayName: "The Proving Grounds",
  exits: { X: { to: "meadowbrook", entry: "default" } },
  entries: { "1": "red", "2": "blue" },
  ascii: paint(),
};
