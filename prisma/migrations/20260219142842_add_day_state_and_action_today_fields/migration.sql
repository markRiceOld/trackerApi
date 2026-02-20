-- CreateTable
CREATE TABLE "DayState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "afterDayCompletedAt" DATETIME,
    "actionGatheringCompletedAt" DATETIME,
    CONSTRAINT "DayState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "tbd" DATETIME,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'P',
    "estimatedTimeMinutes" INTEGER,
    "startTimeOfDay" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "forDate" DATETIME,
    "isGathered" BOOLEAN NOT NULL DEFAULT false,
    "actionFate" TEXT,
    CONSTRAINT "Action_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Action" ("createdAt", "done", "estimatedTimeMinutes", "id", "priority", "projectId", "tbd", "title", "userId") SELECT "createdAt", "done", "estimatedTimeMinutes", "id", "priority", "projectId", "tbd", "title", "userId" FROM "Action";
DROP TABLE "Action";
ALTER TABLE "new_Action" RENAME TO "Action";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DayState_userId_dateKey_key" ON "DayState"("userId", "dateKey");
