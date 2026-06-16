import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateTeamInput, UpdateTeamInput } from '../schemas/team.schema.js';

const teamInclude = {
  managerUser: { select: { id: true, name: true } },
} as const;

async function ensureManagerInOrg(orgId: string, managerUserId: string): Promise<void> {
  const m = await prisma.orgMember.findFirst({ where: { orgId, userId: managerUserId } });
  if (!m) throw new NotFoundError('Manager not found');
}

export const teamService = {
  async list(orgId: string) {
    return prisma.team.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      include: teamInclude,
    });
  },

  async getById(orgId: string, id: string) {
    const team = await prisma.team.findFirst({ where: { id, orgId }, include: teamInclude });
    if (!team) throw new NotFoundError('Team not found');
    return team;
  },

  async create(orgId: string, data: CreateTeamInput) {
    const { managerUserId, ...rest } = data;
    if (managerUserId) await ensureManagerInOrg(orgId, managerUserId);
    return prisma.team.create({
      data: {
        ...rest,
        orgId,
        managerUserId: managerUserId ?? null,
      },
      include: teamInclude,
    });
  },

  async update(orgId: string, id: string, data: UpdateTeamInput) {
    await this.getById(orgId, id);
    const { managerUserId, ...rest } = data;
    if (managerUserId) await ensureManagerInOrg(orgId, managerUserId);
    const patch: Prisma.TeamUpdateInput = { ...rest };
    if (managerUserId !== undefined) {
      patch.managerUser = managerUserId ? { connect: { id: managerUserId } } : { disconnect: true };
    }
    return prisma.team.update({ where: { id }, data: patch, include: teamInclude });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.team.delete({ where: { id } });
  },
};
