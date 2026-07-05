-- Align the Insights default-range "kind" with the Performance-trend vocabulary
-- (rolling_months / calendar_quarter / calendar_half / calendar_year / custom).
ALTER TABLE "Organization" ALTER COLUMN "insightsDefaultKind" SET DEFAULT 'rolling_months';
UPDATE "Organization" SET "insightsDefaultKind" = 'rolling_months' WHERE "insightsDefaultKind" = 'rolling';
