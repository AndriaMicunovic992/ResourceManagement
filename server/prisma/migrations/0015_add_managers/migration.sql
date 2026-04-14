-- Add team manager (single FK on Team) and direct person managers (many-to-many)

-- Team.managerId -> Resource
ALTER TABLE "Team" ADD COLUMN "managerId" TEXT;

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Team_managerId_idx" ON "Team"("managerId");

-- PersonManager join table: a person can have many direct managers
CREATE TABLE "PersonManager" (
  "personId"  TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "orgId"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonManager_pkey" PRIMARY KEY ("personId", "managerId")
);

ALTER TABLE "PersonManager"
  ADD CONSTRAINT "PersonManager_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonManager"
  ADD CONSTRAINT "PersonManager_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonManager"
  ADD CONSTRAINT "PersonManager_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PersonManager_managerId_idx" ON "PersonManager"("managerId");
CREATE INDEX "PersonManager_orgId_idx" ON "PersonManager"("orgId");
