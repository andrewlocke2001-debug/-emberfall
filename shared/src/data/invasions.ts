/**
 * World events v1 (P12.3) — scheduled zone invasions. On a timer (or a GM
 * trigger), a warband storms the zone's gate: escorts around a herald
 * mini-boss. Felling the herald repels the invasion and scatters the rest.
 */
export const INVASION_INTERVAL_MS = 15 * 60_000;
export const INVASION_ESCORTS = 4;
export const INVASION_HERALD = "invasion_herald";
export const INVASION_ESCORT_KIND = "bandit";

/** Overworld zones the warband targets (towns stay safe). */
export const INVASION_ZONES: ReadonlySet<string> = new Set(["greenreach", "tanglewood"]);

/** Enemy-id prefixes so rooms can find and clean up event spawns. */
export const INVASION_HERALD_ID = "inv-herald";
export const INVASION_ESCORT_PREFIX = "inv-escort-";
