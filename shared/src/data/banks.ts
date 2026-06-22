import { BANK_RANGE, type Vec2 } from "../types";
import type { ZoneId } from "./zones";

/**
 * Town bank locations (world coordinates). A player may deposit/withdraw only
 * while standing within BANK_RANGE of one. Data-driven so adding a bank to a
 * town is a one-line edit; the server enforces proximity, the client uses it to
 * show a bank marker and open the bank panel.
 *
 * Meadowbrook's bank sits in the central plaza, near the default spawn.
 */
export const BANKS: Partial<Record<ZoneId, Vec2[]>> = {
  meadowbrook: [{ x: 656, y: 432 }],
};

/** Is (x,y) within range of any bank in the given zone? */
export function nearBank(zoneId: string, x: number, y: number, range: number = BANK_RANGE): boolean {
  const banks = BANKS[zoneId as ZoneId];
  if (!banks) return false;
  return banks.some((b) => Math.hypot(b.x - x, b.y - y) <= range);
}
