import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import type { JoinZoneOptions } from "@mmo/shared";
import type { ZoneState } from "@mmo/shared/schema/state";

/**
 * Server endpoint resolution, in priority order:
 *  1. VITE_SERVER_URL (baked at build time)
 *  2. localhost dev/preview → the local game server on :2567
 *  3. same origin — production default: the Fly server serves this very page
 *     AND the websocket, so wherever the page came from is the server.
 */
function resolveEndpoint(): string {
  const explicit = import.meta.env["VITE_SERVER_URL"] as string | undefined;
  if (explicit) return explicit;
  const { protocol, hostname, host } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "ws://localhost:2567";
  return `${protocol === "https:" ? "wss" : "ws"}://${host}`;
}

const ENDPOINT = resolveEndpoint();
/** Same host, http(s) scheme — used to wake the server before joining. */
const HTTP_BASE = ENDPOINT.replace(/^ws/, "http");

export interface ZoneConnection {
  room: Room<ZoneState>;
  $: (instance: unknown) => any;
}

export type StatusFn = (message: string) => void;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * The free-tier game server may be asleep (Fly stops idle machines). A cold
 * start takes ~10–20s, during which a websocket join would silently hang
 * forever. So before joining we poll the HTTP endpoint — the request itself
 * wakes the machine — and only proceed once it answers. This turns an infinite
 * "stuck on Entering…" into a short, explained wait.
 */
async function wakeServer(onStatus: StatusFn): Promise<void> {
  const deadline = Date.now() + 75_000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(`${HTTP_BASE}/`, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(timer);
      if (res.ok) return;
    } catch {
      // network error / abort → server still waking; fall through and retry
    }
    onStatus(
      attempt <= 1
        ? "Entering Verdant Vale…"
        : "Waking the realm… (a sleeping server takes ~20s on first load)",
    );
    await sleep(1500);
  }
  throw new Error("The server is taking too long to wake up.");
}

/** Connect to (or create) the single shared zone room with this identity. */
export async function connectToZone(
  options: JoinZoneOptions,
  onStatus: StatusFn = () => {},
): Promise<ZoneConnection> {
  await wakeServer(onStatus);
  onStatus("Entering Verdant Vale…");
  const client = new Client(ENDPOINT);
  const room = await client.joinOrCreate<ZoneState>("zone", options);
  const $ = getStateCallbacks(room) as unknown as (instance: unknown) => any;
  return { room, $ };
}
