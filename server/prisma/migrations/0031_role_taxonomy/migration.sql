-- Editable role taxonomy: org-scoped Domain / JobRole / Seniority tables.
-- ResourceRole and Need keep storing domain/role/seniority as name strings;
-- these tables drive the pickers, planner colors and seniority ordering, and
-- renames cascade to the string columns in the app layer.

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seniority" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seniority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Domain_orgId_idx" ON "Domain"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_orgId_name_key" ON "Domain"("orgId", "name");

-- CreateIndex
CREATE INDEX "JobRole_orgId_idx" ON "JobRole"("orgId");

-- CreateIndex
CREATE INDEX "JobRole_domainId_idx" ON "JobRole"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_orgId_domainId_name_key" ON "JobRole"("orgId", "domainId", "name");

-- CreateIndex
CREATE INDEX "Seniority_orgId_idx" ON "Seniority"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Seniority_orgId_name_key" ON "Seniority"("orgId", "name");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seniority" ADD CONSTRAINT "Seniority_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the current built-in taxonomy for every existing org so nothing
-- changes for them on day one. New orgs are seeded in app code (ensureTaxonomy).
INSERT INTO "Domain" ("id", "orgId", "name", "color", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."id", d.name, d.color, d.ord, now(), now()
FROM "Organization" o
CROSS JOIN (VALUES
  ('Data', '#3B82F6', 0),
  ('Web', '#F97316', 1),
  ('General', '#8B5CF6', 2)
) AS d(name, color, ord);

INSERT INTO "JobRole" ("id", "orgId", "domainId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, dom."orgId", dom."id", r.name, r.ord, now(), now()
FROM "Domain" dom
JOIN (VALUES
  ('Data', 'FE', 0), ('Data', 'BE', 1), ('Data', 'PM', 2),
  ('Web', 'FE', 0), ('Web', 'BE', 1), ('Web', 'PM', 2),
  ('General', 'Agent', 0), ('General', 'DevOps', 1), ('General', 'Sales', 2),
  ('General', 'AI Engineer', 3), ('General', 'Consultant', 4), ('General', 'PM', 5)
) AS r(domain, name, ord) ON r.domain = dom."name";

INSERT INTO "Seniority" ("id", "orgId", "name", "shortLabel", "level", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."id", s.name, s.short, s.lvl, now(), now()
FROM "Organization" o
CROSS JOIN (VALUES
  ('Junior', 'Jr', 0),
  ('Medior', 'Mid', 1),
  ('Senior', 'Sr', 2),
  ('Senior Principal', 'SP', 3)
) AS s(name, short, lvl);
