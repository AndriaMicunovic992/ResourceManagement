-- AlterTable
ALTER TABLE "OneOnOne" ADD COLUMN "legacyFieldsMigratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dimensionCode" TEXT,
    "customerId" TEXT,
    "projectId" TEXT,
    "jiraUrl" TEXT,
    "oneOnOneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Log_orgId_idx" ON "Log"("orgId");

-- CreateIndex
CREATE INDEX "Log_resourceId_idx" ON "Log"("resourceId");

-- CreateIndex
CREATE INDEX "Log_authorUserId_idx" ON "Log"("authorUserId");

-- CreateIndex
CREATE INDEX "Log_oneOnOneId_idx" ON "Log"("oneOnOneId");

-- CreateIndex
CREATE INDEX "Log_dimensionCode_idx" ON "Log"("dimensionCode");

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_oneOnOneId_fkey" FOREIGN KEY ("oneOnOneId") REFERENCES "OneOnOne"("id") ON DELETE CASCADE ON UPDATE CASCADE;
