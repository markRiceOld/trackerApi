-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "doa" TEXT,
    "goalId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "predictionDate" DATETIME,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isLast" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Milestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Milestone" ("createdAt", "doa", "goalId", "id", "predictionDate", "title") SELECT "createdAt", "doa", "goalId", "id", "predictionDate", "title" FROM "Milestone";
DROP TABLE "Milestone";
ALTER TABLE "new_Milestone" RENAME TO "Milestone";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
