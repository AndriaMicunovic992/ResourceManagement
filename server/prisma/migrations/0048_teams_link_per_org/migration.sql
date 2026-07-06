-- DropIndex
DROP INDEX "TeamsUserLink_userId_key";

-- AlterTable
ALTER TABLE "TeamsUserLink" ADD COLUMN     "orgId" TEXT;

-- CreateIndex
CREATE INDEX "TeamsUserLink_userId_idx" ON "TeamsUserLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamsUserLink_orgId_userId_key" ON "TeamsUserLink"("orgId", "userId");

-- AddForeignKey
ALTER TABLE "TeamsUserLink" ADD CONSTRAINT "TeamsUserLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

