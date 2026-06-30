-- AlterTable: per-org Microsoft Teams reminder settings
ALTER TABLE "Organization" ADD COLUMN     "teamsReminderTypes" TEXT,
ADD COLUMN     "teamsRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: per-user Teams conversation link (for proactive DMs)
CREATE TABLE "TeamsUserLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aadObjectId" TEXT,
    "serviceUrl" TEXT NOT NULL,
    "conversationRef" JSONB NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamsUserLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamsUserLink_userId_key" ON "TeamsUserLink"("userId");

-- CreateIndex
CREATE INDEX "TeamsUserLink_aadObjectId_idx" ON "TeamsUserLink"("aadObjectId");

-- AddForeignKey
ALTER TABLE "TeamsUserLink" ADD CONSTRAINT "TeamsUserLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
