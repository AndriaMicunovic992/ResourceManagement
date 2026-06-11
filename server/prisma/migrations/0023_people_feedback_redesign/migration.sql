-- 1:1 redesign: pulse score, work satisfaction, summary fields.
-- (generalStatus/personalNotes/careerDevelopment/managerPersonalNotes stay as
-- legacy columns; old records render read-only, new records don't write them.)
ALTER TABLE "OneOnOne" ADD COLUMN "overallScore" INTEGER;
ALTER TABLE "OneOnOne" ADD COLUMN "workSatisfaction" INTEGER;
ALTER TABLE "OneOnOne" ADD COLUMN "wentWell" TEXT;
ALTER TABLE "OneOnOne" ADD COLUMN "wentBad" TEXT;

-- Compensation satisfaction lives on the (less frequent) evaluation cadence.
ALTER TABLE "Evaluation" ADD COLUMN "compensationSatisfaction" INTEGER;

-- In-app reminder cadences (null = off).
ALTER TABLE "Organization" ADD COLUMN "oneOnOneReminderDays" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "pmLogReminderDays" INTEGER;

-- Retype log kinds: polarity labels become entry types. Mechanical rename
-- only — content, links and authorship untouched.
UPDATE "Log" SET "kind" = CASE "kind"
  WHEN 'win' THEN 'strength'
  WHEN 'good' THEN 'strength'
  WHEN 'down' THEN 'concern'
  WHEN 'bad' THEN 'concern'
  WHEN 'observation' THEN 'note'
  ELSE "kind"
END;

-- Threads on log entries.
CREATE TABLE "LogComment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LogComment_orgId_idx" ON "LogComment"("orgId");
CREATE INDEX "LogComment_logId_idx" ON "LogComment"("logId");
ALTER TABLE "LogComment" ADD CONSTRAINT "LogComment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogComment" ADD CONSTRAINT "LogComment_logId_fkey" FOREIGN KEY ("logId") REFERENCES "Log"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogComment" ADD CONSTRAINT "LogComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Follow-up items (open until resolved; visible in every 1:1 cockpit).
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "oneOnOneId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedInOneOnOneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FollowUp_orgId_idx" ON "FollowUp"("orgId");
CREATE INDEX "FollowUp_resourceId_idx" ON "FollowUp"("resourceId");
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_oneOnOneId_fkey" FOREIGN KEY ("oneOnOneId") REFERENCES "OneOnOne"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_resolvedInOneOnOneId_fkey" FOREIGN KEY ("resolvedInOneOnOneId") REFERENCES "OneOnOne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Career thread (append-only, spans 1:1s).
CREATE TABLE "CareerEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "goalStatus" TEXT,
    "oneOnOneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CareerEntry_orgId_idx" ON "CareerEntry"("orgId");
CREATE INDEX "CareerEntry_resourceId_idx" ON "CareerEntry"("resourceId");
ALTER TABLE "CareerEntry" ADD CONSTRAINT "CareerEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerEntry" ADD CONSTRAINT "CareerEntry_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerEntry" ADD CONSTRAINT "CareerEntry_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CareerEntry" ADD CONSTRAINT "CareerEntry_oneOnOneId_fkey" FOREIGN KEY ("oneOnOneId") REFERENCES "OneOnOne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Monthly PM-perceived client satisfaction per (person, customer).
CREATE TABLE "ClientSignal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "note" TEXT,
    "authorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSignal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientSignal_resourceId_customerId_month_key" ON "ClientSignal"("resourceId", "customerId", "month");
CREATE INDEX "ClientSignal_orgId_idx" ON "ClientSignal"("orgId");
CREATE INDEX "ClientSignal_customerId_idx" ON "ClientSignal"("customerId");
CREATE INDEX "ClientSignal_resourceId_idx" ON "ClientSignal"("resourceId");
ALTER TABLE "ClientSignal" ADD CONSTRAINT "ClientSignal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSignal" ADD CONSTRAINT "ClientSignal_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSignal" ADD CONSTRAINT "ClientSignal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSignal" ADD CONSTRAINT "ClientSignal_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
