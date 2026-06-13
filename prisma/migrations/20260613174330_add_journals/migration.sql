-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "linkedGoalId" TEXT,
    "linkedProjectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "defaultForUserId" TEXT,
    CONSTRAINT "Journal_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Journal_linkedProjectId_fkey" FOREIGN KEY ("linkedProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Journal_defaultForUserId_fkey" FOREIGN KEY ("defaultForUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalAccess" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "journalId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalAccess_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "timestampOverridden" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "JournalEntry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoverableByEmail" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password") SELECT "createdAt", "email", "id", "name", "password" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Journal_defaultForUserId_key" ON "Journal"("defaultForUserId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalAccess_journalId_userEmail_key" ON "JournalAccess"("journalId", "userEmail");
