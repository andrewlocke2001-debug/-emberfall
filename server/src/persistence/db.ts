import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Single Prisma client for the server process (Prisma 7 driver-adapter setup).
 *
 * Local dev: SQLite at server/prisma/dev.db — the code default below matches
 * server/.env, so the server runs with or without the env file. Paths are
 * relative to the server workspace dir (npm workspace scripts cwd).
 *
 * Production: set DATABASE_URL to a Postgres connection string AND swap the
 * adapter/provider — see design/DEPLOY.md. Run `npm run db:migrate` once after
 * a fresh clone to create the local database.
 */
const url = process.env["DATABASE_URL"] ?? "file:./prisma/dev.db";

const adapter = new PrismaBetterSqlite3({ url });

export const prisma = new PrismaClient({ adapter });
