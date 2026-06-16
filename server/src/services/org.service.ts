import { prisma } from '../db/prisma.js';
import { NotFoundError, ConflictError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import { inviteService } from './invite.service.js';
import { ensureSystemRoles, roleService } from './role.service.js';

export const orgService = {
  /** Membership row for (user, org), or null. Used to gate org switching. */
  async membershipFor(userId: string, orgId: string) {
    return prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
  },

  async listUserOrgs(userId: string) {
    const memberships = await prisma.orgMember.findMany({
      where: { userId },
      include: { org: true },
    });
    return memberships.map((m) => ({ ...m.org, role: m.role }));
  },

  async createOrg(userId: string, name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const org = await prisma.organization.create({
      data: { name, slug: slug + '-' + Date.now().toString(36) },
    });
    await prisma.orgMember.create({
      data: { userId, orgId: org.id, role: 'owner' },
    });
    await ensureSystemRoles(org.id);
    return org;
  },

  async updateOrg(
    orgId: string,
    data: {
      name?: string;
      minPlanningDate?: string | null;
      maxPlanningDate?: string | null;
      performanceTrendDefaultMonths?: number;
      performanceTrendDefaultKind?: string;
      performanceTrendDefaultFrom?: string | null;
      performanceTrendDefaultTo?: string | null;
      oneOnOneReminderEvery?: number | null;
      oneOnOneReminderUnit?: string | null;
      oneOnOneReminderStart?: string | null;
      pmLogReminderEvery?: number | null;
      pmLogReminderUnit?: string | null;
      pmLogReminderStart?: string | null;
    }
  ) {
    return prisma.organization.update({ where: { id: orgId }, data });
  },

  async deleteOrg(orgId: string) {
    return prisma.organization.delete({ where: { id: orgId } });
  },

  // --- Member management ---

  async listMembers(orgId: string) {
    return prisma.orgMember.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  },

  /**
   * Add an existing user to the org, or — if no account exists for that email
   * yet — create a pending invite they'll claim on first sign-in. Returns a
   * discriminated result so the UI can say "added" vs "invited".
   */
  async addMember(orgId: string, email: string, role: string, invitedByUserId: string) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    });

    if (!user) {
      const invite = await inviteService.create(orgId, email, role, invitedByUserId);
      return { type: 'invited' as const, invite };
    }

    const existing = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });
    if (existing) throw new ConflictError('User is already a member of this organization');

    const member = await prisma.orgMember.create({
      data: { userId: user.id, orgId, role },
      include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
    });
    return { type: 'added' as const, member };
  },

  async updateMemberRole(orgId: string, memberId: string, role: string, requesterId: string) {
    const member = await prisma.orgMember.findFirst({ where: { id: memberId, orgId } });
    if (!member) throw new NotFoundError('Member not found');
    if (member.role === 'owner') throw new ForbiddenError('Cannot change the owner role');
    if (member.userId === requesterId) throw new ForbiddenError('Cannot change your own role');
    if (role === 'owner') throw new ForbiddenError('There can only be one owner');
    // The target role must be a real role in this org (system or custom).
    if (!(await roleService.exists(orgId, role))) {
      throw new BadRequestError('Unknown role');
    }

    return prisma.orgMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
    });
  },

  async removeMember(orgId: string, memberId: string, requesterId: string) {
    const member = await prisma.orgMember.findFirst({ where: { id: memberId, orgId } });
    if (!member) throw new NotFoundError('Member not found');
    if (member.role === 'owner') throw new ForbiddenError('Cannot remove the owner');
    if (member.userId === requesterId) throw new ForbiddenError('Cannot remove yourself');

    await prisma.orgMember.delete({ where: { id: memberId } });
  },
};
