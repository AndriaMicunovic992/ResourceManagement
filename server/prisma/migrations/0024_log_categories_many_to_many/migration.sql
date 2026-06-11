-- Logs ↔ categories become many-to-many: one incident can evidence several
-- dimensions. Copy existing single links into the join table, then drop the
-- old column.
CREATE TABLE "_LogCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_LogCategories_AB_unique" ON "_LogCategories"("A", "B");
CREATE INDEX "_LogCategories_B_index" ON "_LogCategories"("B");
ALTER TABLE "_LogCategories" ADD CONSTRAINT "_LogCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Log"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_LogCategories" ADD CONSTRAINT "_LogCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "PerformanceLogCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "_LogCategories" ("A", "B")
SELECT "id", "categoryId" FROM "Log" WHERE "categoryId" IS NOT NULL;

DROP INDEX IF EXISTS "Log_categoryId_idx";
ALTER TABLE "Log" DROP COLUMN "categoryId";
