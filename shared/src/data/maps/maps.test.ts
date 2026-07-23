import { describe, it, expect } from "vitest";
import meadowbrook from "./meadowbrook.json";
import greenreach from "./greenreach.json";
import tanglewood from "./tanglewood.json";
import cinderDepths from "./cinder_depths.json";
import ashreach from "./ashreach.json";
import moltenThrone from "./molten_throne.json";
import bgArena from "./bg_arena.json";
import marrowgateDowns from "./marrowgate_downs.json";
import refusedColumn from "./refused_column.json";
import vossmere from "./vossmere.json";
import dolmholt from "./dolmholt.json";
import cinderfen from "./cinderfen.json";
import graywastes from "./graywastes.json";
import kindlecourt from "./kindlecourt.json";
import emberheartCaldera from "./emberheart_caldera.json";
import sunkenPyre from "./sunken_pyre.json";
import sealedShift from "./sealed_shift.json";
import bleedworks from "./bleedworks.json";
import lamplightArchive from "./lamplight_archive.json";
import greatwakeIsles from "./greatwake_isles.json";

interface TiledObject {
  name: string;
  type: string;
  properties?: { name: string; value: string }[];
}
interface TiledLayer {
  name: string;
  data?: number[];
  objects?: TiledObject[];
}
interface TiledMap {
  width: number;
  height: number;
  layers: TiledLayer[];
}

const maps: Record<string, TiledMap> = {
  meadowbrook: meadowbrook as unknown as TiledMap,
  greenreach: greenreach as unknown as TiledMap,
  marrowgate_downs: marrowgateDowns as unknown as TiledMap,
  refused_column: refusedColumn as unknown as TiledMap,
  vossmere: vossmere as unknown as TiledMap,
  dolmholt: dolmholt as unknown as TiledMap,
  cinderfen: cinderfen as unknown as TiledMap,
  graywastes: graywastes as unknown as TiledMap,
  kindlecourt: kindlecourt as unknown as TiledMap,
  emberheart_caldera: emberheartCaldera as unknown as TiledMap,
  sunken_pyre: sunkenPyre as unknown as TiledMap,
  sealed_shift: sealedShift as unknown as TiledMap,
  bleedworks: bleedworks as unknown as TiledMap,
  lamplight_archive: lamplightArchive as unknown as TiledMap,
  greatwake_isles: greatwakeIsles as unknown as TiledMap,
  tanglewood: tanglewood as unknown as TiledMap,
  cinder_depths: cinderDepths as unknown as TiledMap,
  ashreach: ashreach as unknown as TiledMap,
  molten_throne: moltenThrone as unknown as TiledMap,
  bg_arena: bgArena as unknown as TiledMap,
};

const layer = (map: TiledMap, name: string): TiledLayer | undefined =>
  map.layers.find((l) => l.name === name);
const markers = (map: TiledMap): TiledObject[] => layer(map, "markers")?.objects ?? [];
const prop = (o: TiledObject, name: string): string | undefined =>
  o.properties?.find((p) => p.name === name)?.value;

describe.each(Object.entries(maps))("generated map: %s", (_id, map) => {
  it("has ground + obstacle tile layers sized width × height", () => {
    for (const name of ["ground", "obstacles"]) {
      const l = layer(map, name);
      expect(l, `missing ${name} layer`).toBeTruthy();
      expect(l!.data!.length).toBe(map.width * map.height);
    }
  });

  it("has exactly one default spawn point", () => {
    expect(markers(map).filter((o) => o.name === "entry:default")).toHaveLength(1);
  });

  it("has at least one training dummy (P2 mob-camp placeholder)", () => {
    expect(markers(map).filter((o) => o.type === "enemy").length).toBeGreaterThan(0);
  });

  it("every exit resolves to a real zone and a matching entry point", () => {
    const exits = markers(map).filter((o) => o.type === "exit");
    expect(exits.length).toBeGreaterThan(0);
    for (const exit of exits) {
      const to = prop(exit, "to");
      const entry = prop(exit, "entry");
      expect(to, "exit missing 'to'").toBeTruthy();
      expect(entry, "exit missing 'entry'").toBeTruthy();
      const target = maps[to!];
      expect(target, `exit points to unknown zone '${to}'`).toBeTruthy();
      const entryNames = markers(target!)
        .filter((o) => o.type === "entry")
        .map((o) => o.name);
      expect(entryNames, `'${to}' has no entry '${entry}'`).toContain(`entry:${entry}`);
    }
  });
});
