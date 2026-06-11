# Emberfall zone server. Build context = repo root (monorepo workspaces):
#   docker build -f server/Dockerfile .
FROM node:24-slim

# Prisma's CLI probes for OpenSSL during generate/migrate; install it so
# detection doesn't fall back to a guess.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install with the full workspace graph so @mmo/shared resolves.
# The Prisma schema + config MUST be present before `npm ci` — the root
# postinstall runs `prisma generate` in the server workspace.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
COPY server/prisma server/prisma
COPY server/prisma.config.ts server/
RUN npm ci

COPY shared/ shared/
COPY server/ server/

EXPOSE 2567

# Apply pending migrations, then start the zone server.
# DATABASE_URL comes from the environment (Fly secrets in prod).
CMD ["sh", "-c", "npm run db:deploy -w @mmo/server && npm start -w @mmo/server"]
