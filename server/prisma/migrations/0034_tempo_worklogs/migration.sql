-- CreateTable
CREATE TABLE "Worklog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tempoWorklogId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "resourceId" TEXT,
    "customerId" TEXT,
    "projectId" TEXT,
    "jiraIssueKey" TEXT,
    "jiraEpicKey" TEXT,
    "workDate" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worklog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Worklog_orgId_idx" ON "Worklog"("orgId");

-- CreateIndex
CREATE INDEX "Worklog_orgId_month_idx" ON "Worklog"("orgId", "month");

-- CreateIndex
CREATE INDEX "Worklog_resourceId_idx" ON "Worklog"("resourceId");

-- CreateIndex
CREATE INDEX "Worklog_customerId_idx" ON "Worklog"("customerId");

-- CreateIndex
CREATE INDEX "Worklog_projectId_idx" ON "Worklog"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Worklog_orgId_tempoWorklogId_key" ON "Worklog"("orgId", "tempoWorklogId");

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worklog" ADD CONSTRAINT "Worklog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

