-- Customer.responsiblePersonId
ALTER TABLE "Customer" ADD COLUMN "responsiblePersonId" TEXT;
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_responsiblePersonId_fkey"
  FOREIGN KEY ("responsiblePersonId") REFERENCES "Resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Customer_responsiblePersonId_idx" ON "Customer"("responsiblePersonId");

-- Evaluation
CREATE TABLE "Evaluation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerNameSnapshot" TEXT NOT NULL,
  "projectId" TEXT,
  "projectNameSnapshot" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'draft',
  "createdByUserId" TEXT NOT NULL,
  "computedFinal" DOUBLE PRECISION,
  "overrideFinal" DOUBLE PRECISION,
  "overrideReason" TEXT,
  "finalizedAt" TIMESTAMP(3),
  "finalizedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Evaluation"
  ADD CONSTRAINT "Evaluation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation"
  ADD CONSTRAINT "Evaluation_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation"
  ADD CONSTRAINT "Evaluation_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evaluation"
  ADD CONSTRAINT "Evaluation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evaluation"
  ADD CONSTRAINT "Evaluation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evaluation"
  ADD CONSTRAINT "Evaluation_finalizedByUserId_fkey"
  FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Evaluation_orgId_idx" ON "Evaluation"("orgId");
CREATE INDEX "Evaluation_resourceId_idx" ON "Evaluation"("resourceId");
CREATE INDEX "Evaluation_customerId_idx" ON "Evaluation"("customerId");
CREATE INDEX "Evaluation_projectId_idx" ON "Evaluation"("projectId");
CREATE INDEX "Evaluation_state_idx" ON "Evaluation"("state");

-- EvaluationCategorySnapshot
CREATE TABLE "EvaluationCategorySnapshot" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "categoryId" TEXT,
  "categoryNameSnapshot" TEXT NOT NULL,
  "categoryGroupingSnapshot" TEXT,
  "weightSnapshot" DOUBLE PRECISION NOT NULL,
  "sortOrderSnapshot" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationCategorySnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EvaluationCategorySnapshot"
  ADD CONSTRAINT "EvaluationCategorySnapshot_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationCategorySnapshot"
  ADD CONSTRAINT "EvaluationCategorySnapshot_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "PerformanceLogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EvaluationCategorySnapshot_evaluationId_categoryNameSnapshot_categoryGroupingSnapshot_key"
  ON "EvaluationCategorySnapshot"("evaluationId", "categoryNameSnapshot", "categoryGroupingSnapshot");
CREATE INDEX "EvaluationCategorySnapshot_evaluationId_idx" ON "EvaluationCategorySnapshot"("evaluationId");

-- EvaluationScore
CREATE TABLE "EvaluationScore" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "categorySnapshotId" TEXT NOT NULL,
  "employeeScore" DOUBLE PRECISION,
  "employeeComment" TEXT,
  "responsibleScore" DOUBLE PRECISION,
  "responsibleComment" TEXT,
  "managerComment" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EvaluationScore"
  ADD CONSTRAINT "EvaluationScore_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationScore"
  ADD CONSTRAINT "EvaluationScore_categorySnapshotId_fkey"
  FOREIGN KEY ("categorySnapshotId") REFERENCES "EvaluationCategorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EvaluationScore_evaluationId_categorySnapshotId_key"
  ON "EvaluationScore"("evaluationId", "categorySnapshotId");
CREATE INDEX "EvaluationScore_evaluationId_idx" ON "EvaluationScore"("evaluationId");

-- Log.evaluationId
ALTER TABLE "Log" ADD COLUMN "evaluationId" TEXT;
ALTER TABLE "Log"
  ADD CONSTRAINT "Log_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Log_evaluationId_idx" ON "Log"("evaluationId");
