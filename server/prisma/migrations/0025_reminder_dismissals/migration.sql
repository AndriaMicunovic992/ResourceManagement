CREATE TABLE "ReminderDismissal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderDismissal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReminderDismissal_orgId_userId_idx" ON "ReminderDismissal"("orgId", "userId");
ALTER TABLE "ReminderDismissal" ADD CONSTRAINT "ReminderDismissal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderDismissal" ADD CONSTRAINT "ReminderDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
