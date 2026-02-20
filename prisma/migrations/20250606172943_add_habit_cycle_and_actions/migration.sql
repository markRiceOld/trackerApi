/*
  Warnings:

  - A unique constraint covering the columns `[habitId]` on the table `Goal` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `behaviorDescription` to the `Habit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentFrequency` to the `Habit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cycleGapDays` to the `Habit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetFrequency` to the `Habit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "HabitCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "controlDays" INTEGER NOT NULL,
    "monitorDays" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HabitCycle_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "tbd" DATETIME,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "habitCycleId" TEXT,
    CONSTRAINT "Action_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Action_habitCycleId_fkey" FOREIGN KEY ("habitCycleId") REFERENCES "HabitCycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Action" ("createdAt", "done", "id", "projectId", "tbd", "title", "userId") SELECT "createdAt", "done", "id", "projectId", "tbd", "title", "userId" FROM "Action";
DROP TABLE "Action";
ALTER TABLE "new_Action" RENAME TO "Action";
CREATE TABLE "new_Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "behaviorDescription" TEXT NOT NULL,
    "currentFrequency" TEXT NOT NULL,
    "targetFrequency" TEXT NOT NULL,
    "cycleGapDays" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Habit" ("createdAt", "id", "title", "userId") SELECT "createdAt", "id", "title", "userId" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Goal_habitId_key" ON "Goal"("habitId");
