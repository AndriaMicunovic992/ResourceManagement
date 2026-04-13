-- CreateTable
CREATE TABLE "OneOnOne" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "goodSides" TEXT,
    "badSides" TEXT,
    "suggestions" TEXT,
    "generalStatus" TEXT,
    "personalNotes" TEXT,
    "careerDevelopment" TEXT,
    "managerPersonalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneOnOne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneOnOne_orgId_idx" ON "OneOnOne"("orgId");

-- CreateIndex
CREATE INDEX "OneOnOne_resourceId_idx" ON "OneOnOne"("resourceId");

-- CreateIndex
CREATE INDEX "OneOnOne_authorUserId_idx" ON "OneOnOne"("authorUserId");

-- AddForeignKey
ALTER TABLE "OneOnOne" ADD CONSTRAINT "OneOnOne_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneOnOne" ADD CONSTRAINT "OneOnOne_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneOnOne" ADD CONSTRAINT "OneOnOne_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
