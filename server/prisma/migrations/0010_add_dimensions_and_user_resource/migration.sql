-- AlterTable
ALTER TABLE "Resource" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Resource_userId_idx" ON "Resource"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_orgId_userId_key" ON "Resource"("orgId", "userId");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Dimension" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dimension_orgId_idx" ON "Dimension"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Dimension_orgId_code_key" ON "Dimension"("orgId", "code");

-- AddForeignKey
ALTER TABLE "Dimension" ADD CONSTRAINT "Dimension_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
