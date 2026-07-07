import { prisma } from '../db/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { roleService } from './role.service.js';

/**
 * Invite-first provisioning. An admin invites an email to an org with a role;
 * the seat sits pending until that person first signs in (Microsoft or local)
 * with a matching, IdP-verified email, at which point it becomes an OrgMember.
 */
export const inviteService = {
  async create(orgId: string, email: string, role: string, invitedByUserId: string) {
    // The invite's role becomes an OrgMember role verbatim on first sign-in, so
    // enforce the same invariants as direct member writes: a real role key of
    // this org, and never 'owner'.
    if (role === 'owner') throw new ForbiddenError('There can only be one owner');
    if (!(await roleService.exists(orgId, role))) {
      throw new BadRequestError('Unknown role');
    }
    const normalized = email.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      include: { memberships: { where: { orgId } } },
    });
    if (existingUser && existingUser.memberships.length > 0) {
      throw new ConflictError('That person is already a member of this organization');
    }

    // Re-inviting an email refreshes the role and clears any prior acceptance.
    return prisma.invite.upsert({
      where: { email_orgId: { email: normalized, orgId } },
      create: { email: normalized, orgId, role, invitedByUserId },
      update: { role, acceptedAt: null, invitedByUserId },
    });
  },

  async list(orgId: string) {
    return prisma.invite.findMany({
      where: { orgId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  async revoke(orgId: string, inviteId: string) {
    const invite = await prisma.invite.findFirst({ where: { id: inviteId, orgId } });
    if (!invite) throw new NotFoundError('Invite not found');
    await prisma.invite.delete({ where: { id: inviteId } });
  },

  /**
   * Consume every pending invite matching any of this user's emails (UPN and
   * mail address can differ in Entra), creating the corresponding memberships.
   * Called on first sign-in. Returns the memberships that now exist for the
   * user (created or pre-existing).
   */
  async consumeForUser(userId: string, emails: string[]) {
    const normalized = emails.map((e) => e.trim().toLowerCase());
    if (normalized.length === 0) return [];
    const pending = await prisma.invite.findMany({
      where: {
        acceptedAt: null,
        OR: normalized.map((e) => ({ email: { equals: e, mode: 'insensitive' as const } })),
      },
    });

    const memberships = [];
    for (const invite of pending) {
      // Create the membership and mark the invite accepted atomically, so a
      // failure can't consume the invite without granting access (or vice versa).
      const membership = await prisma.$transaction(async (tx) => {
        const existing = await tx.orgMember.findUnique({
          where: { userId_orgId: { userId, orgId: invite.orgId } },
        });
        const m =
          existing ??
          (await tx.orgMember.create({
            data: { userId, orgId: invite.orgId, role: invite.role },
          }));
        await tx.invite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });
        return m;
      });
      memberships.push(membership);
    }
    return memberships;
  },
};
