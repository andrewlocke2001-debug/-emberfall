import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Single Prisma client for the server process (Prisma 7 driver-adapter setup).
 *
 * Postgres everywhere: local dev and production both point at Neon via
 * DATABASE_URL — locally from server/.env (gitignored), in production from
 * Fly secrets.
 *
 * Neon's serverless proxy kills idle TCP connections after a few minutes.
 * Without the guards below, a killed idle socket surfaces as an unhandled
 * 'error' event on the pg pool, which crashes the whole Node process — the
 * production "server dies every few minutes" failure mode. So:
 *  - idleTimeoutMillis recycles our idle connections long before Neon does;
 *  - the pool-level error handler absorbs anything that slips through;
 *  - a heartbeat keeps Neon's free-tier compute awake (a suspended database
 *    adds multi-second cold-start latency to the next player's join).
 */
const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Local dev: copy server/.env.example to server/.env. " +
      "Production: `fly secrets set DATABASE_URL=...`",
  );
}

const pool = new pg.Pool({
  connectionString: url,
  max: 5,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] pool error (absorbed, pool will recover):", err.message);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

const HEARTBEAT_MS = 4 * 60_000;
setInterval(() => {
  prisma.$queryRaw`SELECT 1`.catch((err: unknown) => {
    console.error("[db] heartbeat failed:", err instanceof Error ? err.message : err);
  });
}, HEARTBEAT_MS).unref();
