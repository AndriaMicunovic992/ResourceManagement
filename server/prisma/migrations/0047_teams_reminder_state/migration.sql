-- CreateTable
CREATE TABLE "TeamsReminderState" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamsReminderState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamsReminderState_orgId_idx" ON "TeamsReminderState"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamsReminderState_orgId_userId_key" ON "TeamsReminderState"("orgId", "userId");

-- AddForeignKey
ALTER TABLE "TeamsReminderState" ADD CONSTRAINT "TeamsReminderState_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamsReminderState" ADD CONSTRAINT "TeamsReminderState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

