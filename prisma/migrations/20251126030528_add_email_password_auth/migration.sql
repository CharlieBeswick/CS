-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleSub" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "publicName" TEXT,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "dateOfBirth" DATETIME,
    "age" INTEGER,
    "fullName" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "ticketWallet" JSONB,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "credits", "email", "googleSub", "id", "name", "picture", "publicName", "role", "ticketWallet", "updatedAt") SELECT "avatarUrl", "createdAt", "credits", "email", "googleSub", "id", "name", "picture", "publicName", "role", "ticketWallet", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
