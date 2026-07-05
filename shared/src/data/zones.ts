import meadowbrookJson from "./maps/meadowbrook.json";
import greenreachJson from "./maps/greenreach.json";
import tanglewoodJson from "./maps/tanglewood.json";
import { loadZoneMap, type TiledMap, type ZoneMap } from "../systems/zonemap";

/**
 * The world's zones, parsed once from the generated Tiled JSON. Imported by
 * both the server (collision/spawns/exits) and the client (rendering) so they
 * share one source of truth. Regenerate the JSON with `npm run mapgen`.
 */
export const ZONE_IDS = ["meadowbrook", "greenreach", "tanglewood"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const ZONES: Record<ZoneId, ZoneMap> = {
  meadowbrook: loadZoneMap("meadowbrook", meadowbrookJson as unknown as TiledMap),
  greenreach: loadZoneMap("greenreach", greenreachJson as unknown as TiledMap),
  tanglewood: loadZoneMap("tanglewood", tanglewoodJson as unknown as TiledMap),
};

/** Where brand-new characters (and anyone with no valid saved zone) start. */
export const DEFAULT_ZONE: ZoneId = "meadowbrook";

export function isZoneId(s: string): s is ZoneId {
  return (ZONE_IDS as readonly string[]).includes(s);
}
