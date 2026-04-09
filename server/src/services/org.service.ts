import { prisma } from '../db/prisma.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../utils/errors.js';

export const orgService = {
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
    return org;
  },

  async updateOrg(orgId: string, data: { name?: string }) {
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

  async addMember(orgId: string, email: string, role: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError('No user found with that email');

    const existing = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });
    if (existing) throw new ConflictError('User is already a member of this organization');

    const member = await prisma.orgMember.create({
      data: { userId: user.id, orgId, role },
      include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
    });
    return member;
  },

  async updateMemberRole(orgId: string, memberId: string, role: string, requesterId: string) {
    const member = await prisma.orgMember.findFirst({ where: { id: memberId, orgId } });
    if (!member) throw new NotFoundError('Member not found');
    if (member.role === 'owner') throw new ForbiddenError('Cannot change the owner role');
    if (member.userId === requesterId) throw new ForbiddenError('Cannot change your own role');

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
