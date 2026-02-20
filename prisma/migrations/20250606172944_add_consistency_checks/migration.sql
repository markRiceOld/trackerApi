-- Consistency: Action must not have both projectId and habitCycleId set.
-- Consistency: Project must not have both goalId and milestoneId set.
-- Adds priority column and CHECK constraints; runs after habit_cycle migration.

-- Fix existing data: clear one side when both are set
UPDATE "Action" SET "habitCycleId" = NULL WHERE "projectId" IS NOT NULL AND "habitCycleId" IS NOT NULL;
UPDATE "Project" SET "goalId" = NULL WHERE "goalId" IS NOT NULL AND "milestoneId" IS NOT NULL;

-- Recreate Action table with priority and CHECK (at most one of projectId or habitCycleId)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "tbd" DATETIME,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'P',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "habitCycleId" TEXT,
    CONSTRAINT "Action_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Action_habitCycleId_fkey" FOREIGN KEY ("habitCycleId") REFERENCES "HabitCycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Action_project_or_cycle_check" CHECK ("projectId" IS NULL OR "habitCycleId" IS NULL)
);

INSERT INTO "new_Action" ("id", "title", "tbd", "done", "priority", "createdAt", "projectId", "userId", "habitCycleId")
SELECT "id", "title", "tbd", "done", 'P', "createdAt", "projectId", "userId", "habitCycleId" FROM "Action";

DROP TABLE "Action";
ALTER TABLE "new_Action" RENAME TO "Action";

-- Recreate Project table with priority and CHECK (at most one of goalId or milestoneId)
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "dod" TEXT,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "priority" TEXT NOT NULL DEFAULT 'P',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "goalId" TEXT,
    "milestoneId" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Project_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_goal_or_milestone_check" CHECK ("goalId" IS NULL OR "milestoneId" IS NULL)
);

INSERT INTO "new_Project" ("id", "title", "dod", "type", "priority", "createdAt", "updatedAt", "goalId", "milestoneId", "userId")
SELECT "id", "title", "dod", "type", 'P', "createdAt", "updatedAt", "goalId", "milestoneId", "userId" FROM "Project";

DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
