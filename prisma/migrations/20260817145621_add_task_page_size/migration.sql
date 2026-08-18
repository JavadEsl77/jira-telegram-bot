-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL,
    "jiraUsername" TEXT,
    "jiraDisplayName" TEXT,
    "jiraAccountId" TEXT,
    "jiraToken" TEXT,
    "taskPageSize" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "id", "jiraAccountId", "jiraDisplayName", "jiraToken", "jiraUsername", "telegramId", "updatedAt") SELECT "createdAt", "id", "jiraAccountId", "jiraDisplayName", "jiraToken", "jiraUsername", "telegramId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
