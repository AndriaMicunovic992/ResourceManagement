-- AlterTable
ALTER TABLE "Project" ADD COLUMN "responsiblePersonId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
