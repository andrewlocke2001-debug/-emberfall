import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MapSource } from "./types";
import { meadowbrook } from "./maps/meadowbrook";
import { greenreach } from "./maps/greenreach";
import { tanglewood } from "./maps/tanglewood";
import { cinderDepths } from "./maps/cinder_depths";
import { ashreach } from "./maps/ashreach";
import { moltenThrone } from "./maps/molten_throne";
import { bgArena } from "./maps/bg_arena";
import { marrowgateDowns } from "./maps/marrowgate_downs";
import { refusedColumn } from "./maps/refused_column";
import { vossmere } from "./maps/vossmere";
import { dolmholt } from "./maps/dolmholt";
import { cinderfen } from "./maps/cinderfen";
import { graywastes } from "./maps/graywastes";
import { kindlecourt } from "./maps/kindlecourt";
import { emberheartCaldera } from "./maps/emberheart_caldera";
import { sunkenPyre } from "./maps/sunken_pyre";
import { sealedShift } from "./maps/sealed_shift";
import { bleedworks } from "./maps/bleedworks";
import { lamplightArchive } from "./maps/lamplight_archive";
import { greatwakeIsles } from "./maps/greatwake_isles";

/**
 * ASCII → Tiled-format JSON compiler. Run from the repo root:
 *   npm run mapgen
 *
 * Output is standard Tiled JSON (openable in the Tiled editor), consumed by
 * both the server (collision/exits/spawns) and the client (rendering) via
 * shared/src/systems/zonemap.ts. Tile size is 32px; the tileset image named
 * here never ships — the client paints its own texture at runtime.
 */

const TILE = 32;

/** gids: 1 grass · 2 path · 3 wall · 4 tree · 5 water · 6 floor · 7 fence */
const GROUND: Record<string, number> = {
  ".": 1,
  ",": 2,
  "#": 1,
  T: 1,
  "~": 1,
  "=": 6,
  f: 1,
  s: 2,
  D: 1,
  e: 1,
  w: 1,
  b: 1,
  t: 1,
  r: 1,
  m: 1,
  W: 6,
  E: 2,
  p: 1,
  u: 1,
  g: 1,
  K: 6,
  c: 1,
  h: 1,
  L: 1,
  d: 1,
  o: 1,
  q: 1,
  n: 1,
  y: 1,
  j: 1,
  z: 1,
  v: 1,
  G: 1,
  k: 1,
  x: 1,
  a: 1,
  H: 1,
  Y: 1,
  J: 1,
  Q: 1,
  Z: 1,
  O: 1,
  U: 1,
  M: 1,
  P: 1,
  V: 1,
};
const OBSTACLE: Record<string, number> = { "#": 3, T: 4, "~": 5, f: 7 };

/** Map chars to mob families (see @mmo/shared/data/mobs). */
const ENEMY_CHARS: Record<string, string> = {
  D: "dummy",
  e: "emberling",
  w: "wolf",
  b: "bandit",
  t: "thorn_stalker",
  r: "ruin_sentinel",
  m: "ember_wraith",
  W: "warden_of_ash",
  p: "barrow_wisp",
  u: "unreturned_wanderer",
  g: "marrow_warden",
  K: "gatewright",
  c: "quenchclaw",
  h: "salt_shade",
  L: "wreck_looter",
  d: "scree_hound",
  o: "open_vein_cutter",
  q: "deep_echo",
  n: "fen_creeper",
  y: "glass_stalker",
  j: "harvest_enforcer",
  z: "frost_wight",
  v: "cache_reaver",
  G: "beacon_congregant",
  k: "unreturned_courtier",
  x: "court_sentinel",
  a: "archive_warden",
  H: "cinder_husk",
  Y: "wound_wraith",
  J: "throne_herald",
  Q: "pyre_admiral",
  Z: "bell_foreman",
  O: "intake_overseer",
  U: "provost_ilsever",
  M: "wakespawn",
  P: "keel_shade",
  V: "leviathanling",
};

const MAPS: MapSource[] = [meadowbrook, greenreach, tanglewood, cinderDepths, ashreach, moltenThrone, bgArena, marrowgateDowns, refusedColumn, vossmere, dolmholt, cinderfen, graywastes, kindlecourt, emberheartCaldera, sunkenPyre, sealedShift, bleedworks, lamplightArchive, greatwakeIsles];

function compile(src: MapSource): object {
  const height = src.ascii.length;
  const width = src.ascii[0]?.length ?? 0;
  if (width === 0 || height === 0) throw new Error(`${src.id}: empty map`);

  const ground: number[] = [];
  const obstacles: number[] = [];
  const objects: object[] = [];
  let nextObjectId = 1;
  let sawSpawn = false;
  const seenEntries = new Set<string>();

  const isEntryChar = (ch: string): boolean => ch >= "0" && ch <= "9";

  for (let y = 0; y < height; y++) {
    const row = src.ascii[y]!;
    if (row.length !== width) {
      throw new Error(`${src.id}: row ${y} is ${row.length} chars, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const isExit = ch in src.exits;
      const isEntry = isEntryChar(ch);

      const groundGid = isExit || isEntry ? 2 : GROUND[ch];
      if (groundGid === undefined) {
        throw new Error(`${src.id}: unknown char '${ch}' at (${x},${y})`);
      }
      ground.push(groundGid);
      obstacles.push(OBSTACLE[ch] ?? 0);

      const px = x * TILE;
      const py = y * TILE;
      const cx = px + TILE / 2;
      const cy = py + TILE / 2;

      if (isExit) {
        const exit = src.exits[ch]!;
        objects.push({
          id: nextObjectId++,
          name: "exit",
          type: "exit",
          x: px,
          y: py,
          width: TILE,
          height: TILE,
          rotation: 0,
          visible: true,
          properties: [
            { name: "to", type: "string", value: exit.to },
            { name: "entry", type: "string", value: exit.entry },
          ],
        });
      } else if (isEntry) {
        const name = src.entries[ch];
        if (!name) throw new Error(`${src.id}: entry char '${ch}' has no name in entries`);
        if (seenEntries.has(ch)) throw new Error(`${src.id}: duplicate entry char '${ch}'`);
        seenEntries.add(ch);
        objects.push(point(nextObjectId++, `entry:${name}`, "entry", cx, cy));
      } else if (ch === "s") {
        if (sawSpawn) throw new Error(`${src.id}: more than one default spawn 's'`);
        sawSpawn = true;
        objects.push(point(nextObjectId++, "entry:default", "entry", cx, cy));
      } else if (ENEMY_CHARS[ch]) {
        const kind = ENEMY_CHARS[ch];
        objects.push({
          ...point(nextObjectId++, `enemy:${kind}`, "enemy", cx, cy),
          properties: [{ name: "kind", type: "string", value: kind }],
        });
      }
    }
  }

  if (!sawSpawn) throw new Error(`${src.id}: missing default spawn 's'`);
  for (const ch of Object.keys(src.exits)) {
    if (!src.ascii.some((r) => r.includes(ch))) {
      throw new Error(`${src.id}: exit char '${ch}' never placed`);
    }
  }
  for (const ch of Object.keys(src.entries)) {
    if (!seenEntries.has(ch)) throw new Error(`${src.id}: entry char '${ch}' never placed`);
  }

  return {
    type: "map",
    version: "1.10",
    orientation: "orthogonal",
    renderorder: "right-down",
    infinite: false,
    width,
    height,
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: 4,
    nextobjectid: nextObjectId,
    properties: [{ name: "displayName", type: "string", value: src.displayName }],
    tilesets: [
      {
        firstgid: 1,
        name: "emberfall-tiles",
        tilewidth: TILE,
        tileheight: TILE,
        tilecount: 7,
        columns: 7,
        spacing: 0,
        margin: 0,
        image: "emberfall-tiles.png",
        imagewidth: 7 * TILE,
        imageheight: TILE,
      },
    ],
    layers: [
      tileLayer(1, "ground", width, height, ground),
      tileLayer(2, "obstacles", width, height, obstacles),
      {
        id: 3,
        type: "objectgroup",
        name: "markers",
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        draworder: "topdown",
        objects,
      },
    ],
  };
}

function point(id: number, name: string, type: string, x: number, y: number): object {
  return { id, name, type, x, y, width: 0, height: 0, rotation: 0, visible: true, point: true };
}

function tileLayer(id: number, name: string, width: number, height: number, data: number[]): object {
  return { id, type: "tilelayer", name, width, height, x: 0, y: 0, opacity: 1, visible: true, data };
}

// --- main --------------------------------------------------------------------

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "shared", "src", "data", "maps");
mkdirSync(outDir, { recursive: true });

for (const src of MAPS) {
  const compiled = compile(src);
  const file = join(outDir, `${src.id}.json`);
  writeFileSync(file, JSON.stringify(compiled));
  console.log(`[mapgen] ${src.id}: ${src.ascii[0]!.length}x${src.ascii.length} -> ${file}`);
}
