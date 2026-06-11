-- Reminder schedules: anchored start date + every-N daily/weekly/monthly
-- (replaces the simple day-count cadences).
ALTER TABLE "Organization" DROP COLUMN "oneOnOneReminderDays";
ALTER TABLE "Organization" DROP COLUMN "pmLogReminderDays";
ALTER TABLE "Organization" ADD COLUMN "oneOnOneReminderEvery" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "oneOnOneReminderUnit" TEXT;
ALTER TABLE "Organization" ADD COLUMN "oneOnOneReminderStart" TEXT;
ALTER TABLE "Organization" ADD COLUMN "pmLogReminderEvery" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "pmLogReminderUnit" TEXT;
ALTER TABLE "Organization" ADD COLUMN "pmLogReminderStart" TEXT;

-- Drop the legacy pre-cockpit 1:1 fields and their content.
ALTER TABLE "OneOnOne" DROP COLUMN "generalStatus";
ALTER TABLE "OneOnOne" DROP COLUMN "personalNotes";
ALTER TABLE "OneOnOne" DROP COLUMN "careerDevelopment";
ALTER TABLE "OneOnOne" DROP COLUMN "managerPersonalNotes";
