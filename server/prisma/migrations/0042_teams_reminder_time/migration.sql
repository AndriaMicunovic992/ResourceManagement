-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "teamsReminderHour" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "teamsReminderTimezone" TEXT;

