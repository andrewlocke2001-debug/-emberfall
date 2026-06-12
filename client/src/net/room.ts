import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import type { JoinZoneOptions } from "@mmo/shared";
import type { ZoneState } from "@mmo/shared/schema/state";

/**
 * Server endpoint resolution, in priority order:
 *  1. VITE_SERVER_URL (baked at build time — e.g. a Netlify deploy pointing
 *     at a separate game server)
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

/**
 * A live connection to a zone room: the typed room handle plus the
 * `getStateCallbacks` factory (`$`) used to subscribe to schema changes.
 *
 * `$` is typed loosely on purpose — the generic plumbing of the callback proxy
 * is awkward to thread through, and the authoritative reads we care about
 * (`room.state.players.get(...)`) are fully typed via `Room<ZoneState>`.
 */
export interface ZoneConnection {
  room: Room<ZoneState>;
  $: (instance: unknown) => any;
}

/** Connect to (or create) the single shared zone room with this identity. */
export async function connectToZone(options: JoinZoneOptions): Promise<ZoneConnection> {
  const client = new Client(ENDPOINT);
  const room = await client.joinOrCreate<ZoneState>("zone", options);
  const $ = getStateCallbacks(room) as unknown as (instance: unknown) => any;
  return { room, $ };
}
