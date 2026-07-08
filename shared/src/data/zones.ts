import meadowbrookJson from "./maps/meadowbrook.json";
import greenreachJson from "./maps/greenreach.json";
import tanglewoodJson from "./maps/tanglewood.json";
import cinderDepthsJson from "./maps/cinder_depths.json";
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
export const ZONE_IDS = ["meadowbrook", "greenreach", "tanglewood"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const DUNGEON_IDS = ["cinder_depths"] as const;
export type DungeonId = (typeof DUNGEON_IDS)[number];

export const ZONES: Record<ZoneId, ZoneMap> = {
  meadowbrook: loadZoneMap("meadowbrook", meadowbrookJson as unknown as TiledMap),
  greenreach: loadZoneMap("greenreach", greenreachJson as unknown as TiledMap),
  tanglewood: loadZoneMap("tanglewood", tanglewoodJson as unknown as TiledMap),
};

export const DUNGEONS: Record<DungeonId, ZoneMap> = {
  cinder_depths: loadZoneMap("cinder_depths", cinderDepthsJson as unknown as TiledMap),
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
