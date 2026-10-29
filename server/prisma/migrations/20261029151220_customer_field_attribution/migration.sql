-- AlterTable
ALTER TABLE "JiraConnection" ADD COLUMN     "customerFieldId" TEXT,
ADD COLUMN     "customerFieldName" TEXT;

-- AlterTable
ALTER TABLE "JiraWorkItem" ADD COLUMN     "customerFromField" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Worklog" ADD COLUMN     "jiraCustomerOrg" TEXT;
