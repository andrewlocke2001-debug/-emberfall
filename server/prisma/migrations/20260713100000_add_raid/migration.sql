-- AlterTable (P12 raid weekly lockout)
ALTER TABLE "Player" ADD COLUMN "raidLockUntil" DOUBLE PRECISION NOT NULL DEFAULT 0;
