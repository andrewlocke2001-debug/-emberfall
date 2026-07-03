import { PartyRegistry } from "@mmo/shared/systems/party";

/**
 * The process-wide party registry (one instance across all zone rooms).
 * Pure state lives in @mmo/shared/systems/party (unit-tested); rooms wire it
 * to netcode and fan roster updates out via the globalBus. Third Redis seam
 * for P11 multi-process.
 */
export const parties = new PartyRegistry();
