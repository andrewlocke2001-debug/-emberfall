import meadowbrookJson from "./maps/meadowbrook.json";
import greenreachJson from "./maps/greenreach.json";
import tanglewoodJson from "./maps/tanglewood.json";
import cinderDepthsJson from "./maps/cinder_depths.json";
import ashreachJson from "./maps/ashreach.json";
import moltenThroneJson from "./maps/molten_throne.json";
import bgArenaJson from "./maps/bg_arena.json";
import marrowgateDownsJson from "./maps/marrowgate_downs.json";
import refusedColumnJson from "./maps/refused_column.json";
import vossmereJson from "./maps/vossmere.json";
import dolmholtJson from "./maps/dolmholt.json";
import cinderfenJson from "./maps/cinderfen.json";
import { loadZoneMap, type TiledMap, type ZoneMap } from "../systems/zonemap";

/**
 * The world's zones, parsed once from the generated Tiled JSON. Imported by
 * both the server (collision/spawns/exits) and the client (rendering) so they
 * share one source of truth. Regenerate the JSON with `npm run mapgen`.
 *
 * ZONE_IDS are the shared overworld zones (one persistent room each).
 * DUNGEON_IDS are instanced maps (one room PER RUN, matched by party) — they
 * deliberately stay out of ZONE_IDS so nothing treats them as overworld.
 */
export const ZONE_IDS = ["meadowbrook", "greenreach", "marrowgate_downs", "tanglewood", "vossmere", "dolmholt", "cinderfen", "ashreach"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Zones where open PvP (with anti-grief rules) is enabled — the risk zones. */
export const PVP_ZONES: ReadonlySet<string> = new Set(["ashreach"]);

export const DUNGEON_IDS = ["cinder_depths", "refused_column", "molten_throne", "bg_arena"] as const;
export type DungeonId = (typeof DUNGEON_IDS)[number];

export const ZONES: Record<ZoneId, ZoneMap> = {
  meadowbrook: loadZoneMap("meadowbrook", meadowbrookJson as unknown as TiledMap),
  greenreach: loadZoneMap("greenreach", greenreachJson as unknown as TiledMap),
  tanglewood: loadZoneMap("tanglewood", tanglewoodJson as unknown as TiledMap),
  ashreach: loadZoneMap("ashreach", ashreachJson as unknown as TiledMap),
  marrowgate_downs: loadZoneMap("marrowgate_downs", marrowgateDownsJson as unknown as TiledMap),
  vossmere: loadZoneMap("vossmere", vossmereJson as unknown as TiledMap),
  dolmholt: loadZoneMap("dolmholt", dolmholtJson as unknown as TiledMap),
  cinderfen: loadZoneMap("cinderfen", cinderfenJson as unknown as TiledMap),
};

export const DUNGEONS: Record<DungeonId, ZoneMap> = {
  cinder_depths: loadZoneMap("cinder_depths", cinderDepthsJson as unknown as TiledMap),
  molten_throne: loadZoneMap("molten_throne", moltenThroneJson as unknown as TiledMap),
  bg_arena: loadZoneMap("bg_arena", bgArenaJson as unknown as TiledMap),
  refused_column: loadZoneMap("refused_column", refusedColumnJson as unknown as TiledMap),
};

/** Where brand-new characters (and anyone with no valid saved zone) start. */
export const DEFAULT_ZONE: ZoneId = "meadowbrook";

export function isZoneId(s: string): s is ZoneId {
  return (ZONE_IDS as readonly string[]).includes(s);
}

export function isDungeonId(s: string): s is DungeonId {
  return (DUNGEON_IDS as readonly string[]).includes(s);
}

/** Any playable map (overworld zone or dungeon) by id. */
export function mapForId(id: string): ZoneMap | undefined {
  if (isZoneId(id)) return ZONES[id];
  if (isDungeonId(id)) return DUNGEONS[id];
  return undefined;
}
