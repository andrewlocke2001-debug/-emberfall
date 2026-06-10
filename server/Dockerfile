# Emberfall zone server. Build context = repo root (monorepo workspaces):
#   docker build -f server/Dockerfile .
FROM node:24-slim

WORKDIR /app

# Install with the full workspace graph so @mmo/shared resolves.
# postinstall runs `prisma generate` (schema-only, no DB needed).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY shared/ shared/
COPY server/ server/

EXPOSE 2567

# Apply pending migrations, then start the zone server.
# DATABASE_URL must be set in the environment (Postgres in prod).
CMD ["sh", "-c", "npm run db:deploy -w @mmo/server && npm start -w @mmo/server"]
