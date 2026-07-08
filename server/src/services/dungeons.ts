import { randomUUID } from "node:crypto";

/**
 * Dungeon instance tickets. A ticket is an unguessable token that routes a
 * player (and their party) to ONE shared instance of a dungeon room via
 * Colyseus `filterBy(["ticket"])`, and names exactly who is allowed in.
 *
 * A party stepping onto the gate within the TTL window resolves to the SAME
 * ticket (keyed by the sorted member signature), so members land in the same
 * instance; different parties / solos get different tickets → separate
 * instances. Process-local like the other social seams (Redis at P11).
 */
const TICKET_TTL_MS = 10 * 60_000;

interface Ticket {
  id: string;
  /** Lower-cased display names permitted to join this instance. */
  members: Set<string>;
  createdAt: number;
}

const byId = new Map<string, Ticket>();
const bySignature = new Map<string, Ticket>();

const key = (name: string): string => name.trim().toLowerCase();
const signature = (names: string[]): string => names.map(key).sort().join("|");

export const dungeons = {
  /** Get (or mint) the shared ticket for this set of member names. */
  ticketFor(names: string[]): string {
    const sig = signature(names);
    const now = Date.now();
    const existing = bySignature.get(sig);
    if (existing && now - existing.createdAt < TICKET_TTL_MS) return existing.id;
    const ticket: Ticket = { id: randomUUID(), members: new Set(names.map(key)), createdAt: now };
    byId.set(ticket.id, ticket);
    bySignature.set(sig, ticket);
    return ticket.id;
  },

  /** Is this player named on the ticket? (defends against ticket sharing). */
  allows(ticketId: string, name: string): boolean {
    const ticket = byId.get(ticketId);
    return !!ticket && ticket.members.has(key(name));
  },
};
