-- CreateTable
CREATE TABLE "TierLobby" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "minPlayers" INTEGER NOT NULL DEFAULT 3,
    "maxPlayers" INTEGER NOT NULL DEFAULT 10,
    "baseSpinForce" INTEGER NOT NULL DEFAULT 20,
    "countdownSeconds" INTEGER NOT NULL DEFAULT 8,
    "countdownStartsAt" DATETIME,
    "gameStartsAt" DATETIME,
    "resolvedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LobbyPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "luckyNumber" INTEGER NOT NULL,
    "luckyNumberRevealed" BOOLEAN NOT NULL DEFAULT false,
    "lastLuckyNumberChange" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "ticketTierUsed" TEXT NOT NULL,
    "ticketTransactionId" TEXT,
    "refundedTransactionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "LobbyPlayer_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "TierLobby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LobbyPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LobbyRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lobbyId" TEXT NOT NULL,
    "spinForceBase" INTEGER NOT NULL,
    "spinForceTotal" INTEGER NOT NULL,
    "spinForceFinal" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "LobbyChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LobbyChatMessage_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "TierLobby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LobbyChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TierLobby_tier_idx" ON "TierLobby"("tier");

-- CreateIndex
CREATE INDEX "TierLobby_status_idx" ON "TierLobby"("status");

-- CreateIndex
CREATE INDEX "TierLobby_createdAt_idx" ON "TierLobby"("createdAt");

-- CreateIndex
CREATE INDEX "LobbyPlayer_userId_idx" ON "LobbyPlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyPlayer_lobbyId_userId_key" ON "LobbyPlayer"("lobbyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyRound_lobbyId_key" ON "LobbyRound"("lobbyId");

-- CreateIndex
CREATE INDEX "LobbyRound_lobbyId_idx" ON "LobbyRound"("lobbyId");

-- CreateIndex
CREATE INDEX "LobbyRound_createdAt_idx" ON "LobbyRound"("createdAt");

-- CreateIndex
CREATE INDEX "LobbyChatMessage_lobbyId_createdAt_idx" ON "LobbyChatMessage"("lobbyId", "createdAt");

-- CreateIndex
CREATE INDEX "LobbyChatMessage_userId_idx" ON "LobbyChatMessage"("userId");
