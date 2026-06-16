-- Team & people managers move from a Resource (staffable employee) to any org
-- User (a login user) — same shift we already made for customer/project
-- responsibility in 0028. A manager is now a member, not a person record.
-- Existing managers carry over via the manager resource's linked login user;
-- managers held by resources without a login user are dropped (they couldn't
-- sign in to act as a manager anyway).

-- ── Team.managerId (Resource) -> managerUserId (User) ──────────────────────
ALTER TABLE "Team" ADD COLUMN "managerUserId" TEXT;

UPDATE "Team" t
   SET "managerUserId" = r."userId"
  FROM "Resource" r
 WHERE t."managerId" = r."id"
   AND r."userId" IS NOT NULL;

ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_managerId_fkey";
DROP INDEX IF EXISTS "Team_managerId_idx";
ALTER TABLE "Team" DROP COLUMN "managerId";

CREATE INDEX "Team_managerUserId_idx" ON "Team"("managerUserId");
ALTER TABLE "Team" ADD CONSTRAINT "Team_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── PersonManager.managerId (Resource) -> managerUserId (User) ─────────────
ALTER TABLE "PersonManager" ADD COLUMN "managerUserId" TEXT;

UPDATE "PersonManager" pm
   SET "managerUserId" = r."userId"
  FROM "Resource" r
 WHERE pm."managerId" = r."id"
   AND r."userId" IS NOT NULL;

-- Drop links whose manager had no login user (can't act as a manager).
DELETE FROM "PersonManager" WHERE "managerUserId" IS NULL;

-- Two distinct manager resources can't share a login user within an org
-- (Resource has a unique (orgId, userId)), but dedup defensively so the new
-- (personId, managerUserId) primary key can't collide.
DELETE FROM "PersonManager" a
 USING "PersonManager" b
 WHERE a.ctid < b.ctid
   AND a."personId" = b."personId"
   AND a."managerUserId" = b."managerUserId";

ALTER TABLE "PersonManager" DROP CONSTRAINT IF EXISTS "PersonManager_pkey";
ALTER TABLE "PersonManager" DROP CONSTRAINT IF EXISTS "PersonManager_managerId_fkey";
DROP INDEX IF EXISTS "PersonManager_managerId_idx";
ALTER TABLE "PersonManager" DROP COLUMN "managerId";

ALTER TABLE "PersonManager" ALTER COLUMN "managerUserId" SET NOT NULL;
ALTER TABLE "PersonManager" ADD CONSTRAINT "PersonManager_pkey" PRIMARY KEY ("personId", "managerUserId");
ALTER TABLE "PersonManager" ADD CONSTRAINT "PersonManager_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "PersonManager_managerUserId_idx" ON "PersonManager"("managerUserId");
