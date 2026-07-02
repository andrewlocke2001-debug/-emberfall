/**
 * Process-local presence registry: which display names are online, and where.
 * Each ZoneRoom registers players on join and unregisters on leave; the
 * friends system reads it for online/zone status. Keys are lower-cased names
 * (display names are unique per account). Like globalBus, this is the seam
 * that becomes Redis when the server goes multi-process (P11).
 */
interface PresenceEntry {
  /** Exact display name (original casing). */
  name: string;
  zone: string;
}

class Presence {
  private readonly online = new Map<string, PresenceEntry>();

  register(name: string, zone: string): void {
    this.online.set(name.trim().toLowerCase(), { name, zone });
  }

  unregister(name: string): void {
    this.online.delete(name.trim().toLowerCase());
  }

  /** Presence for a display name, or undefined if offline. */
  get(name: string): PresenceEntry | undefined {
    return this.online.get(name.trim().toLowerCase());
  }
}

export const presence = new Presence();
