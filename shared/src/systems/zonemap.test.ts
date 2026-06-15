import { describe, it, expect } from "vitest";
import { exitAt } from "./zonemap";
import { ZONES } from "../data/zones";

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

  it("every exit points at a real zone with the named entry", () => {
    for (const map of Object.values(ZONES)) {
      for (const exit of map.exits) {
        const target = ZONES[exit.to as keyof typeof ZONES];
        expect(target, `exit to unknown zone '${exit.to}'`).toBeTruthy();
        expect(target.entries[exit.entry], `'${exit.to}' missing entry '${exit.entry}'`).toBeTruthy();
      }
    }
  });
});
