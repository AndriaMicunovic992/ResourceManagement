-- WARNING: This migration drops legacy OneOnOne text columns.
-- It MUST be applied only AFTER the Phase 2 data migration script
-- (server/scripts/migrate_oneonone_logs.ts) has been run successfully,
-- otherwise the goodSides / badSides / suggestions content will be lost.

-- AlterTable
ALTER TABLE "OneOnOne" DROP COLUMN "goodSides";
ALTER TABLE "OneOnOne" DROP COLUMN "badSides";
ALTER TABLE "OneOnOne" DROP COLUMN "suggestions";
ALTER TABLE "OneOnOne" DROP COLUMN "legacyFieldsMigratedAt";
