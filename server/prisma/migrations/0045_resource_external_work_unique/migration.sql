-- A Jira account maps to at most one person per org. Postgres treats NULLs as
-- distinct, so unmatched people (externalWorkId NULL) are unaffected; only
-- duplicate non-null mappings are rejected.
-- CreateIndex
CREATE UNIQUE INDEX "Resource_orgId_externalWorkId_key" ON "Resource"("orgId", "externalWorkId");

-- Align a pre-existing index name with the current schema (no data change).
-- RenameIndex
ALTER INDEX "EvaluationCategorySnapshot_evaluationId_categoryNameSnapshot_ca" RENAME TO "EvaluationCategorySnapshot_evaluationId_categoryNameSnapsho_key";
