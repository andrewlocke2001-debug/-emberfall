import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import type { JoinZoneOptions } from "@mmo/shared";
import type { ZoneState } from "@mmo/shared/schema/state";

const ENDPOINT =
  (import.meta.env["VITE_SERVER_URL"] as string | undefined) ?? "ws://localhost:2567";

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
