-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "insightsDefaultEnd" TEXT,
ADD COLUMN     "insightsDefaultKind" TEXT NOT NULL DEFAULT 'rolling',
ADD COLUMN     "insightsDefaultMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "insightsDefaultStart" TEXT;
