-- Remove Habit and HabitCycle; drop habitCycleId from Action and habitId from Goal.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Recreate Action without habitCycleId
CREATE TABLE "new_Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "tbd" DATETIME,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'P',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Action_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Action" ("id", "title", "tbd", "done", "priority", "createdAt", "projectId", "userId")
SELECT "id", "title", "tbd", "done", "priority", "createdAt", "projectId", "userId" FROM "Action";
DROP TABLE "Action";
ALTER TABLE "new_Action" RENAME TO "Action";

-- Drop unique index on Goal(habitId) before recreating Goal
DROP INDEX IF EXISTS "Goal_habitId_key";

-- Recreate Goal without habitId
CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "dod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Goal" ("id", "title", "dod", "createdAt", "startDate", "endDate", "userId")
SELECT "id", "title", "dod", "createdAt", "startDate", "endDate", "userId" FROM "Goal";
DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";

-- Drop habit tables (HabitCycle first due to FK to Habit)
DROP TABLE "HabitCycle";
DROP TABLE "Habit";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
