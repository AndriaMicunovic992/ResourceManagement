-- Responsibility moves from a Resource (staffable employee) to any org User
-- (a login user). Existing responsibilities carry over via the resource's
-- linked login user; responsibilities held by resources without a login user
-- are dropped (those people couldn't sign in to act on them anyway).

-- Customer.responsiblePersonId (Resource) -> responsibleUserId (User)
ALTER TABLE "Customer" ADD COLUMN "responsibleUserId" TEXT;
UPDATE "Customer" c
   SET "responsibleUserId" = r."userId"
  FROM "Resource" r
 WHERE c."responsiblePersonId" = r."id"
   AND r."userId" IS NOT NULL;

ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS "Customer_responsiblePersonId_fkey";
DROP INDEX IF EXISTS "Customer_responsiblePersonId_idx";
ALTER TABLE "Customer" DROP COLUMN "responsiblePersonId";

CREATE INDEX "Customer_responsibleUserId_idx" ON "Customer"("responsibleUserId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Project.responsiblePersonId (Resource) -> responsibleUserId (User)
ALTER TABLE "Project" ADD COLUMN "responsibleUserId" TEXT;
UPDATE "Project" p
   SET "responsibleUserId" = r."userId"
  FROM "Resource" r
 WHERE p."responsiblePersonId" = r."id"
   AND r."userId" IS NOT NULL;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_responsiblePersonId_fkey";
DROP INDEX IF EXISTS "Project_responsiblePersonId_idx";
ALTER TABLE "Project" DROP COLUMN "responsiblePersonId";

CREATE INDEX "Project_responsibleUserId_idx" ON "Project"("responsibleUserId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A Log may now be a general entry about a customer/project with no specific
-- person (resourceId NULL). These roll into the evaluation of every person
-- working on that customer/project.
ALTER TABLE "Log" ALTER COLUMN "resourceId" DROP NOT NULL;
