-- AlterTable: default performance trend window (in months) for new performance views.
ALTER TABLE "Organization" ADD COLUMN "performanceTrendDefaultMonths" INTEGER NOT NULL DEFAULT 12;
