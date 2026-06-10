-- Make local password optional: SSO-provisioned users have no local password.
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Microsoft/Entra identity fields.
ALTER TABLE "User" ADD COLUMN "microsoftId" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'local';
CREATE UNIQUE INDEX "User_microsoftId_key" ON "User"("microsoftId");

-- Invite-first provisioning: pending org access keyed by email.
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,
    "invitedByUserId" TEXT,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invite_email_orgId_key" ON "Invite"("email", "orgId");
CREATE INDEX "Invite_orgId_idx" ON "Invite"("orgId");
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

ALTER TABLE "Invite" ADD CONSTRAINT "Invite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
