-- Add weight, active, sortOrder to PerformanceLogCategory.
-- Existing rows take the column defaults (weight=0, active=true, sortOrder=0).

ALTER TABLE "PerformanceLogCategory"
  ADD COLUMN "weight"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "active"    BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN "sortOrder" INTEGER          NOT NULL DEFAULT 0;
