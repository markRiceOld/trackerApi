/*
  Warnings:

  - You are about to drop the column `timeOfDay` on the `Routine` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Routine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "estimatedTimeMinutes" INTEGER,
    "endTime" DATETIME,
    "timeOfDayBlocks" TEXT,
    "timerDurationMinutes" INTEGER,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Routine" ("createdAt", "endTime", "estimatedTimeMinutes", "id", "status", "timeOfDayBlocks", "timerDurationMinutes", "title", "updatedAt", "userId") SELECT "createdAt", "endTime", "estimatedTimeMinutes", "id", "status", "timeOfDayBlocks", "timerDurationMinutes", "title", "updatedAt", "userId" FROM "Routine";
DROP TABLE "Routine";
ALTER TABLE "new_Routine" RENAME TO "Routine";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
