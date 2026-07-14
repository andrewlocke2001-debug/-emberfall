import { dungeons } from "./dungeons";

/**
 * Battleground matchmaking (P12.2). Players queue from anywhere; when two are
 * waiting the match pops: one instance ticket (reusing the dungeon ticket
 * service, so `filterBy(["ticket"])` and the join gate both work unchanged)
 * and a team per name. Process-local like the other social seams.
 */
export type BgTeam = "red" | "blue";

interface Waiting {
  name: string;
  /** Fires when the match pops: transfer this player to the instance. */
  notify: (ticket: string, team: BgTeam) => void;
}

const queue: Waiting[] = [];
const teamsByTicket = new Map<string, Map<string, BgTeam>>();

const key = (name: string): string => name.trim().toLowerCase();

export const battleground = {
  /** Join the queue (idempotent per name). Pops a match at two players. */
  enqueue(name: string, notify: (ticket: string, team: BgTeam) => void): boolean {
    if (queue.some((w) => key(w.name) === key(name))) return false;
    queue.push({ name, notify });
    if (queue.length >= 2) {
      const a = queue.shift()!;
      const b = queue.shift()!;
      const ticket = dungeons.ticketFor([a.name, b.name]);
      teamsByTicket.set(
        ticket,
        new Map([
          [key(a.name), "red"],
          [key(b.name), "blue"],
        ]),
      );
      a.notify(ticket, "red");
      b.notify(ticket, "blue");
    }
    return true;
  },

  /** Drop out of the queue (disconnect or cancel). */
  dequeue(name: string): void {
    const i = queue.findIndex((w) => key(w.name) === key(name));
    if (i >= 0) queue.splice(i, 1);
  },

  /** The team assigned to this name for a popped match. */
  teamOf(ticket: string, name: string): BgTeam {
    return teamsByTicket.get(ticket)?.get(key(name)) ?? "red";
  },
};
