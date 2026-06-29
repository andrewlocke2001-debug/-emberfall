import type { ZoneId } from "./zones";

/**
 * Vendors (shops), data-driven like NPCs. A vendor sells the items in its
 * `stock` at their value (a coin sink) and buys most items back at a fraction
 * (a coin faucet). Pricing math lives in systems/shop; the server is
 * authoritative and proximity-gates trades.
 */
export interface VendorDef {
  id: string;
  name: string;
  zone: ZoneId;
  x: number;
  y: number;
  /** Item ids this vendor sells. */
  stock: string[];
  /** Client render tint. */
  color: number;
}

export const VENDORS: Record<string, VendorDef> = {
  bram_general: {
    id: "bram_general",
    name: "Trader Bram",
    zone: "meadowbrook",
    x: 624,
    y: 432,
    stock: ["health_potion", "shrimp", "bronze_helm", "leather_body", "bronze_sword"],
    color: 0xd1b24f,
  },
};

export function vendorDef(id: string): VendorDef | undefined {
  return VENDORS[id];
}

export function vendorsInZone(zoneId: string): VendorDef[] {
  return Object.values(VENDORS).filter((v) => v.zone === zoneId);
}
