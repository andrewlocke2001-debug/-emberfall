-- AlterTable (P10 retention: hunts, titles, ironman)
ALTER TABLE "Player" ADD COLUMN "hunt" JSONB,
ADD COLUMN "huntPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "title" TEXT;

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "ironman" BOOLEAN NOT NULL DEFAULT false;
