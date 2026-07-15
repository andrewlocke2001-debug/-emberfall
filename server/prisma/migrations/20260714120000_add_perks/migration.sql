-- AlterTable (the Melee skill tree)
ALTER TABLE "Player" ADD COLUMN "perks" JSONB NOT NULL DEFAULT '[]';
