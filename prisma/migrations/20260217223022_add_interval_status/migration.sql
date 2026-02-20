-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Interval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "endTime" DATETIME,
    "repeatValue" INTEGER NOT NULL DEFAULT 1,
    "repeatUnit" TEXT,
    "customRepeatDates" TEXT,
    "goalId" TEXT,
    "milestoneId" TEXT,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interval_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Interval_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Interval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Interval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Interval" ("createdAt", "customRepeatDates", "endTime", "goalId", "id", "milestoneId", "projectId", "repeatUnit", "repeatValue", "title", "updatedAt", "userId") SELECT "createdAt", "customRepeatDates", "endTime", "goalId", "id", "milestoneId", "projectId", "repeatUnit", "repeatValue", "title", "updatedAt", "userId" FROM "Interval";
DROP TABLE "Interval";
ALTER TABLE "new_Interval" RENAME TO "Interval";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
