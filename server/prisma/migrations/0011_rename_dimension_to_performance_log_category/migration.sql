-- DropIndex
DROP INDEX IF EXISTS "Log_dimensionCode_idx";

-- AlterTable
ALTER TABLE "Log" DROP COLUMN IF EXISTS "dimensionCode";
ALTER TABLE "Log" ADD COLUMN "categoryId" TEXT;

-- DropTable
DROP TABLE IF EXISTS "Dimension";

-- CreateTable
CREATE TABLE "PerformanceLogCategory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "grouping" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceLogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceLogCategory_orgId_idx" ON "PerformanceLogCategory"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceLogCategory_orgId_grouping_name_key" ON "PerformanceLogCategory"("orgId", "grouping", "name");

-- CreateIndex
CREATE INDEX "Log_categoryId_idx" ON "Log"("categoryId");

-- AddForeignKey
ALTER TABLE "PerformanceLogCategory" ADD CONSTRAINT "PerformanceLogCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PerformanceLogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
