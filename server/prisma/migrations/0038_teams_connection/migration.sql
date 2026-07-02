-- CreateTable
CREATE TABLE "TeamsConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "botAppId" TEXT,
    "botAppPassword" TEXT,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamsConnection_orgId_key" ON "TeamsConnection"("orgId");

-- AddForeignKey
ALTER TABLE "TeamsConnection" ADD CONSTRAINT "TeamsConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

