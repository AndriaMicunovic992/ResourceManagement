import { prisma } from '../db/prisma.js';

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
};
