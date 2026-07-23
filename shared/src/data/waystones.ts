import type { ZoneId } from "./zones";

/**
 * Waystones (P11.2) — the fast-travel network. One per safe hub zone, placed
 * at that zone's `default` entry so a jump lands the traveller on the stone.
 * Interacting with a waystone lets you pay a small coin fee (a sink) to warp to
 * any other waystone. The dangerous Ashreach is deliberately excluded — you
 * walk into danger.
 */
export interface WaystoneDef {
  id: string;
  zone: ZoneId;
  /** Placed at the zone's `default` entry. */
  x: number;
  y: number;
  name: string;
}

export const WAYSTONES: Record<string, WaystoneDef> = {
  ws_meadowbrook: { id: "ws_meadowbrook", zone: "meadowbrook", x: 592, y: 464, name: "Meadowbrook" },
  ws_greenreach: { id: "ws_greenreach", zone: "greenreach", x: 208, y: 1008, name: "Greenreach" },
  ws_tanglewood: { id: "ws_tanglewood", zone: "tanglewood", x: 208, y: 1008, name: "Tanglewood" },
  ws_marrowgate: { id: "ws_marrowgate", zone: "marrowgate_downs", x: 1008, y: 1712, name: "Marrowgate Downs" },
  ws_vossmere: { id: "ws_vossmere", zone: "vossmere", x: 1024, y: 592, name: "The Vossmere" },
  ws_dolmholt: { id: "ws_dolmholt", zone: "dolmholt", x: 912, y: 1744, name: "The Dolmholt" },
  ws_cinderfen: { id: "ws_cinderfen", zone: "cinderfen", x: 208, y: 1008, name: "The Cinderfen" },
  ws_graywastes: { id: "ws_graywastes", zone: "graywastes", x: 208, y: 1008, name: "The Graywastes" },
  ws_kindlecourt: { id: "ws_kindlecourt", zone: "kindlecourt", x: 944, y: 144, name: "The Kindlecourt" },
  ws_emberheart: { id: "ws_emberheart", zone: "emberheart_caldera", x: 976, y: 1712, name: "The Last Camp" },
  ws_greatwake: { id: "ws_greatwake", zone: "greatwake_isles", x: 400, y: 1552, name: "Hearthholm" },
};

export function waystoneById(id: string): WaystoneDef | undefined {
  return WAYSTONES[id];
}

export function waystonesInZone(zoneId: string): WaystoneDef[] {
  return Object.values(WAYSTONES).filter((w) => w.zone === zoneId);
}
