-- CreateTable
CREATE TABLE "PersonSkill" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resourceId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "PersonSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonSkill_resourceId_idx" ON "PersonSkill"("resourceId");

-- CreateIndex
CREATE INDEX "PersonSkill_skillId_idx" ON "PersonSkill"("skillId");

-- CreateIndex
CREATE INDEX "PersonSkill_orgId_idx" ON "PersonSkill"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonSkill_resourceId_skillId_key" ON "PersonSkill"("resourceId", "skillId");

-- AddForeignKey
ALTER TABLE "PersonSkill" ADD CONSTRAINT "PersonSkill_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSkill" ADD CONSTRAINT "PersonSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSkill" ADD CONSTRAINT "PersonSkill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
