-- CreateTable
CREATE TABLE "GameHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameNumber" BIGINT NOT NULL,
    "lobbyId" TEXT,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "minPlayers" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "spinForceBase" INTEGER NOT NULL,
    "spinForceTotal" INTEGER NOT NULL,
    "spinForceFinal" INTEGER NOT NULL,
    "winningNumber" INTEGER,
    "winningSegment" INTEGER,
    "seed" TEXT,
    "wheelSegments" JSONB,
    "countdownStartedAt" DATETIME,
    "gameStartedAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameHistoryPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameHistoryId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "luckyNumber" INTEGER,
    "ticketTierUsed" TEXT,
    "joinedAt" DATETIME,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GameHistoryPlayer_gameHistoryId_fkey" FOREIGN KEY ("gameHistoryId") REFERENCES "GameHistory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameHistoryArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rangeStart" BIGINT,
    "rangeEnd" BIGINT,
    "gameCount" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "GameHistory_gameNumber_key" ON "GameHistory"("gameNumber");

-- CreateIndex
CREATE INDEX "GameHistory_gameNumber_idx" ON "GameHistory"("gameNumber");

-- CreateIndex
CREATE INDEX "GameHistory_resolvedAt_idx" ON "GameHistory"("resolvedAt");
