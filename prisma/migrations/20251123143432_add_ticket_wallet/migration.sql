-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN "tier" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ticketWallet" JSONB;

-- CreateTable
CREATE TABLE "FreeAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "didWin" BOOLEAN NOT NULL DEFAULT false,
    "awardedTier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FreeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FreeAttempt_userId_idx" ON "FreeAttempt"("userId");

-- CreateIndex
CREATE INDEX "FreeAttempt_userId_createdAt_idx" ON "FreeAttempt"("userId", "createdAt");
