import type { CollisionGrid } from "./collision";
import { buildCollisionGrid } from "./collision";

/**
 * Parses Tiled-format map JSON (produced by tools/mapgen) into a runtime
 * `ZoneMap`: tile layers for rendering, a collision grid, and the spawn /
 * exit / enemy markers. Pure and engine-agnostic — the server uses it for
 * authority (collision, spawns) and the client uses it for rendering, from
 * the exact same data.
 */

export interface TiledProperty {
  name: string;
  value: string;
}
export interface TiledObject {
  name: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  properties?: TiledProperty[];
}
export interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: TiledObject[];
}
export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  properties?: TiledProperty[];
  layers: TiledLayer[];
}

export interface ZonePoint {
  x: number;
  y: number;
}
export interface ZoneExit extends ZonePoint {
  w: number;
  h: number;
  to: string;
  entry: string;
}
export interface ZoneEnemy extends ZonePoint {
  kind: string;
}

export interface ZoneMap {
  id: string;
  displayName: string;
  cols: number;
  rows: number;
  tileSize: number;
  pixelWidth: number;
  pixelHeight: number;
  /** Row-major tile gids for the ground layer (always present per cell). */
  ground: readonly number[];
  /** Row-major tile gids for the obstacle layer (0 = no obstacle). */
  obstacles: readonly number[];
  collision: CollisionGrid;
  /** Named spawn points; "default" is guaranteed to exist. */
  entries: Record<string, ZonePoint>;
  exits: readonly ZoneExit[];
  enemies: readonly ZoneEnemy[];
}

/** The exit whose rectangle contains world point (x, y), if any. */
export function exitAt(map: ZoneMap, x: number, y: number): ZoneExit | undefined {
  return map.exits.find((e) => x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h);
}

function findLayer(map: TiledMap, name: string): TiledLayer {
  const l = map.layers.find((x) => x.name === name);
  if (!l) throw new Error(`map missing layer '${name}'`);
  return l;
}
function objProp(o: TiledObject, name: string): string | undefined {
  return o.properties?.find((p) => p.name === name)?.value;
}

export function loadZoneMap(id: string, map: TiledMap): ZoneMap {
  const cols = map.width;
  const rows = map.height;
  const tileSize = map.tilewidth;

  const ground = findLayer(map, "ground").data;
  const obstacles = findLayer(map, "obstacles").data;
  if (!ground || !obstacles) throw new Error(`map '${id}' is missing tile data`);

  const collision = buildCollisionGrid(cols, rows, tileSize, obstacles);

  const entries: Record<string, ZonePoint> = {};
  const exits: ZoneExit[] = [];
  const enemies: ZoneEnemy[] = [];
  for (const o of findLayer(map, "markers").objects ?? []) {
    if (o.type === "entry") {
      entries[o.name.replace(/^entry:/, "")] = { x: o.x, y: o.y };
    } else if (o.type === "exit") {
      exits.push({
        x: o.x,
        y: o.y,
        w: o.width ?? tileSize,
        h: o.height ?? tileSize,
        to: objProp(o, "to") ?? "",
        entry: objProp(o, "entry") ?? "default",
      });
    } else if (o.type === "enemy") {
      enemies.push({ kind: objProp(o, "kind") ?? "dummy", x: o.x, y: o.y });
    }
  }
  if (!entries["default"]) throw new Error(`map '${id}' has no default entry`);

  return {
    id,
    displayName: map.properties?.find((p) => p.name === "displayName")?.value ?? id,
    cols,
    rows,
    tileSize,
    pixelWidth: cols * tileSize,
    pixelHeight: rows * tileSize,
    ground,
    obstacles,
    collision,
    entries,
    exits,
    enemies,
  };
}
