/*
  Warnings:

  - You are about to drop the column `finalRotation` on the `LobbyRound` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GameHistory" ADD COLUMN "spinRotationEnd" REAL;
ALTER TABLE "GameHistory" ADD COLUMN "spinRotationStart" REAL;
ALTER TABLE "GameHistory" ADD COLUMN "spinTotalDegrees" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LobbyRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lobbyId" TEXT NOT NULL,
    "spinForceBase" INTEGER NOT NULL,
    "spinForceTotal" INTEGER NOT NULL,
    "spinForceFinal" INTEGER NOT NULL,
    "spinRotationStart" REAL,
    "spinRotationEnd" REAL,
    "spinTotalDegrees" REAL,
    "seed" TEXT,
    "wheelSegments" JSONB,
    "winningSegment" INTEGER,
    "winningNumber" INTEGER,
    "spinStartedAt" DATETIME,
    "spinCompletedAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "winningPlayerId" TEXT,
    CONSTRAINT "LobbyRound_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "TierLobby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LobbyRound_winningPlayerId_fkey" FOREIGN KEY ("winningPlayerId") REFERENCES "LobbyPlayer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LobbyRound" ("createdAt", "id", "lobbyId", "resolvedAt", "seed", "spinCompletedAt", "spinForceBase", "spinForceFinal", "spinForceTotal", "spinStartedAt", "updatedAt", "wheelSegments", "winningNumber", "winningPlayerId", "winningSegment") SELECT "createdAt", "id", "lobbyId", "resolvedAt", "seed", "spinCompletedAt", "spinForceBase", "spinForceFinal", "spinForceTotal", "spinStartedAt", "updatedAt", "wheelSegments", "winningNumber", "winningPlayerId", "winningSegment" FROM "LobbyRound";
DROP TABLE "LobbyRound";
ALTER TABLE "new_LobbyRound" RENAME TO "LobbyRound";
CREATE UNIQUE INDEX "LobbyRound_lobbyId_key" ON "LobbyRound"("lobbyId");
CREATE INDEX "LobbyRound_lobbyId_idx" ON "LobbyRound"("lobbyId");
CREATE INDEX "LobbyRound_createdAt_idx" ON "LobbyRound"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
