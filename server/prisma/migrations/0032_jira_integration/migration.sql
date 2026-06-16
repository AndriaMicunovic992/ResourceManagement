-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "externalWorkId" TEXT;

-- CreateTable
CREATE TABLE "JiraConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "baseUrl" TEXT,
    "jiraEmail" TEXT,
    "jiraApiToken" TEXT,
    "tempoApiToken" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraWorkItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'project',
    "externalKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "customerId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JiraConnection_orgId_key" ON "JiraConnection"("orgId");

-- CreateIndex
CREATE INDEX "JiraWorkItem_orgId_idx" ON "JiraWorkItem"("orgId");

-- CreateIndex
CREATE INDEX "JiraWorkItem_parentId_idx" ON "JiraWorkItem"("parentId");

-- CreateIndex
CREATE INDEX "JiraWorkItem_customerId_idx" ON "JiraWorkItem"("customerId");

-- CreateIndex
CREATE INDEX "JiraWorkItem_projectId_idx" ON "JiraWorkItem"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "JiraWorkItem_orgId_externalKey_key" ON "JiraWorkItem"("orgId", "externalKey");

-- AddForeignKey
ALTER TABLE "JiraConnection" ADD CONSTRAINT "JiraConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JiraWorkItem" ADD CONSTRAINT "JiraWorkItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JiraWorkItem" ADD CONSTRAINT "JiraWorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JiraWorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JiraWorkItem" ADD CONSTRAINT "JiraWorkItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JiraWorkItem" ADD CONSTRAINT "JiraWorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
