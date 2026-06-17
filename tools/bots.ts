/**
 * Headless load/regression bots. Each bot is a real Colyseus SDK client that
 * authenticates as a guest, joins a zone, then walks + fights like a player —
 * exactly the same intents (`move`, `useAbility`) a browser sends, so the
 * server can't tell them apart. Used for load testing (P2 exit: "50 bots run
 * for an hour without server degradation") and as a quick regression smoke.
 *
 *   npm run bots -- --count 50
 *   npm run bots -- --count 10 --zone greenreach --duration 60
 *   npm run bots -- --server https://emberfall-server.fly.dev --count 5
 *
 * Flags:
 *   --count N      how many bots          (default 25)
 *   --zone ID      zone room to join      (default greenreach — where mobs are)
 *   --server URL   server origin          (default http://localhost:2567)
 *   --duration S   stop after S seconds   (default 0 = run until Ctrl-C)
 *
 * NOTE: each bot registers a guest account (Account + Player row). A big or
 * repeated run leaves junk rows — run load tests against a throwaway Neon
 * branch, not the shared dev DB, once that split exists.
 */
import { Client, type Room } from "@colyseus/sdk";
import { ABILITY_RANGE, ClientMessage, GCD_MS } from "@mmo/shared";
import { DEFAULT_ZONE, isZoneId } from "@mmo/shared/data/zones";

interface Args {
  count: number;
  zone: string;
  server: string;
  durationMs: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const zone = get("--zone") ?? "greenreach";
  return {
    count: Math.max(1, Number(get("--count") ?? 25)),
    zone: isZoneId(zone) ? zone : DEFAULT_ZONE,
    server: get("--server") ?? "http://localhost:2567",
    durationMs: Math.max(0, Number(get("--duration") ?? 0)) * 1000,
  };
}

const args = parseArgs(process.argv.slice(2));

/** Minimal view of the synced state the bot reads (avoids a schema import). */
interface Pos {
  x: number;
  y: number;
}
interface EnemyView extends Pos {
  id: string;
  alive: boolean;
}

let shuttingDown = false;
let connected = 0;
const rooms = new Set<Room>();

/** Acquire a guest session token for one bot. */
async function guestToken(name: string): Promise<string> {
  const res = await fetch(`${args.server}/auth/guest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`guest auth failed: ${res.status}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** Pick the nearest living enemy to a point, if any. */
function nearestEnemy(room: Room, from: Pos): EnemyView | null {
  let best: EnemyView | null = null;
  let bestDist = Infinity;
  // The SDK decodes state into a MapSchema with forEach((value, key) => ...).
  (room.state.enemies as { forEach: (cb: (e: EnemyView, id: string) => void) => void }).forEach(
    (e, id) => {
      if (!e.alive) return;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bestDist) {
        bestDist = d;
        best = { id, x: e.x, y: e.y, alive: e.alive };
      }
    },
  );
  return best;
}

/** Drive one bot: connect, then loop move/attack until shutdown. */
async function runBot(index: number): Promise<void> {
  const client = new Client(args.server);
  const name = `Bot-${index + 1}`;
  let token: string;
  try {
    token = await guestToken(name);
  } catch (err) {
    console.error(`[bots] ${name} could not auth:`, (err as Error).message);
    return;
  }

  let lastDir = { dx: 0, dy: 0 };
  let moveTimer: ReturnType<typeof setInterval> | undefined;
  let combatTimer: ReturnType<typeof setInterval> | undefined;

  const clearTimers = (): void => {
    if (moveTimer) clearInterval(moveTimer);
    if (combatTimer) clearInterval(combatTimer);
    moveTimer = combatTimer = undefined;
  };

  const send = (room: Room, dx: number, dy: number): void => {
    if (Math.abs(dx - lastDir.dx) < 0.05 && Math.abs(dy - lastDir.dy) < 0.05) return;
    lastDir = { dx, dy };
    room.send(ClientMessage.Move, { dx, dy });
  };

  const attach = (room: Room): void => {
    rooms.add(room);
    connected++;

    // Bots don't react to server messages (welcome/combat/chat/levelUp/
    // transfer) — swallow them all so the SDK doesn't warn per message.
    room.onMessage("*", () => {});

    // Movement: steer toward the nearest mob; wander if there's none in view.
    moveTimer = setInterval(() => {
      const me = room.state.players.get(room.sessionId) as Pos | undefined;
      if (!me) return;
      const target = nearestEnemy(room, me);
      if (target) {
        const dist = Math.hypot(target.x - me.x, target.y - me.y);
        if (dist <= ABILITY_RANGE * 0.8) {
          send(room, 0, 0); // in range — hold position and let combat fire
        } else {
          const len = dist || 1;
          send(room, (target.x - me.x) / len, (target.y - me.y) / len);
        }
      } else {
        send(room, Math.random() * 2 - 1, Math.random() * 2 - 1); // wander
      }
    }, 450);

    // Combat: every GCD, hit the nearest in-range mob with a basic Strike.
    combatTimer = setInterval(() => {
      const me = room.state.players.get(room.sessionId) as Pos | undefined;
      if (!me) return;
      const target = nearestEnemy(room, me);
      if (target && Math.hypot(target.x - me.x, target.y - me.y) <= ABILITY_RANGE) {
        room.send(ClientMessage.UseAbility, { abilityId: "strike", targetId: target.id });
      }
    }, GCD_MS);

    room.onLeave(() => {
      clearTimers();
      rooms.delete(room);
      connected--;
      if (!shuttingDown) setTimeout(() => void join(), 1000 + Math.random() * 2000);
    });
    room.onError((code, message) => {
      console.error(`[bots] ${name} room error ${code}: ${message ?? ""}`);
    });
  };

  const join = async (): Promise<void> => {
    if (shuttingDown) return;
    try {
      const room = await client.joinOrCreate(args.zone, { token });
      attach(room);
    } catch (err) {
      if (!shuttingDown) {
        console.error(`[bots] ${name} join failed (retrying):`, (err as Error).message);
        setTimeout(() => void join(), 2000 + Math.random() * 2000);
      }
    }
  };

  await join();
}

async function main(): Promise<void> {
  console.log(
    `[bots] launching ${args.count} bots → ${args.server} zone "${args.zone}"` +
      (args.durationMs ? ` for ${args.durationMs / 1000}s` : " (Ctrl-C to stop)"),
  );

  // Stagger connections so we don't thundering-herd the matchmaker.
  for (let i = 0; i < args.count; i++) {
    void runBot(i);
    await new Promise((r) => setTimeout(r, 60));
  }

  const stats = setInterval(() => {
    console.log(`[bots] connected: ${connected}/${args.count}`);
  }, 10_000);

  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(stats);
    console.log(`[bots] shutting down — disconnecting ${rooms.size} bots…`);
    await Promise.allSettled([...rooms].map((r) => r.leave()));
    setTimeout(() => process.exit(0), 500);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  if (args.durationMs) setTimeout(() => void shutdown(), args.durationMs);
}

void main();
