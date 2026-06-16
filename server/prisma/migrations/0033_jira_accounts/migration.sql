-- CreateTable
CREATE TABLE "JiraAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JiraAccount_orgId_idx" ON "JiraAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "JiraAccount_orgId_accountId_key" ON "JiraAccount"("orgId", "accountId");

-- AddForeignKey
ALTER TABLE "JiraAccount" ADD CONSTRAINT "JiraAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
