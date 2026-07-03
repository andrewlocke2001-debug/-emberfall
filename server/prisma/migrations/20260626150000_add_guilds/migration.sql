-- AlterTable
ALTER TABLE "Player" ADD COLUMN "guildId" TEXT,
ADD COLUMN "guildRank" TEXT;

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_tag_key" ON "Guild"("tag");

-- CreateIndex
CREATE INDEX "Player_guildId_idx" ON "Player"("guildId");
