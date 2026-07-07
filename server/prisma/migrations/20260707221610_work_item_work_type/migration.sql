-- AlterTable
ALTER TABLE "JiraWorkItem" ADD COLUMN     "workType" TEXT NOT NULL DEFAULT 'client';

-- AlterTable
ALTER TABLE "Worklog" ADD COLUMN     "workType" TEXT NOT NULL DEFAULT 'client';
