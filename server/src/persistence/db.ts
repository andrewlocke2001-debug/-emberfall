import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Single Prisma client for the server process (Prisma 7 driver-adapter setup).
 *
 * Postgres everywhere: local dev and production both point at Neon via
 * DATABASE_URL — locally from server/.env (gitignored), in production from
 * Fly secrets. One engine, one set of migrations, no dialect drift.
 *
 * Fail fast when unset: a zone server silently running without persistence
 * would lose characters, which is strictly worse than not starting.
 */
const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Local dev: copy server/.env.example to server/.env. " +
      "Production: `fly secrets set DATABASE_URL=...`",
  );
}

const adapter = new PrismaPg(url);

export const prisma = new PrismaClient({ adapter });
