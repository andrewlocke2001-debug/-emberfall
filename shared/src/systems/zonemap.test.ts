import { describe, it, expect } from "vitest";
import { exitAt } from "./zonemap";
import { ZONES, DUNGEONS, mapForId } from "../data/zones";

describe("exitAt (real maps)", () => {
  it("detects standing on Meadowbrook's east gate → Greenreach", () => {
    const map = ZONES.meadowbrook;
    const gate = map.exits[0]!;
    // A point inside the gate rectangle resolves to that exit.
    const hit = exitAt(map, gate.x + gate.w / 2, gate.y + gate.h / 2);
    expect(hit).toBeTruthy();
    expect(hit!.to).toBe("greenreach");
  });

  it("returns undefined away from any gate (the town spawn)", () => {
    const map = ZONES.meadowbrook;
    const spawn = map.entries["default"]!;
    expect(exitAt(map, spawn.x, spawn.y)).toBeUndefined();
  });

  it("every exit points at a real map (zone or dungeon) with the named entry", () => {
    for (const map of [...Object.values(ZONES), ...Object.values(DUNGEONS)]) {
      for (const exit of map.exits) {
        const target = mapForId(exit.to);
        expect(target, `exit to unknown map '${exit.to}'`).toBeTruthy();
        expect(target!.entries[exit.entry], `'${exit.to}' missing entry '${exit.entry}'`).toBeTruthy();
      }
    }
  });
});
