-- AlterTable
ALTER TABLE "Action" ADD COLUMN "estimatedTimeMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Interval" ADD COLUMN "estimatedTimeMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN "estimatedTimeMinutes" INTEGER;
