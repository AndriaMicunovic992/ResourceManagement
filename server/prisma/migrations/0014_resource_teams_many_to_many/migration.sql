-- Convert Resource <-> Team from single FK to many-to-many

-- Create implicit M2M join table (Prisma convention: A=Resource, B=Team alphabetically)
CREATE TABLE "_ResourceTeams" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_ResourceTeams_AB_unique" ON "_ResourceTeams"("A", "B");
CREATE INDEX "_ResourceTeams_B_index" ON "_ResourceTeams"("B");

ALTER TABLE "_ResourceTeams"
  ADD CONSTRAINT "_ResourceTeams_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_ResourceTeams"
  ADD CONSTRAINT "_ResourceTeams_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing scalar teamId
INSERT INTO "_ResourceTeams" ("A", "B")
SELECT "id", "teamId" FROM "Resource" WHERE "teamId" IS NOT NULL;

-- Drop the old scalar column and its index/FK
ALTER TABLE "Resource" DROP CONSTRAINT IF EXISTS "Resource_teamId_fkey";
DROP INDEX IF EXISTS "Resource_teamId_idx";
ALTER TABLE "Resource" DROP COLUMN "teamId";
