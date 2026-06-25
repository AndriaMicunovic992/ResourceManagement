-- AlterTable: nightly auto-sync toggle + last-run status for JiraConnection
ALTER TABLE "JiraConnection" ADD COLUMN     "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastAutoSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastAutoSyncError" TEXT,
ADD COLUMN     "lastAutoSyncStatus" TEXT;
