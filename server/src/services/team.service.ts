import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateTeamInput, UpdateTeamInput } from '../schemas/team.schema.js';

const teamInclude = {
  manager: { select: { id: true, name: true } },
} as const;

async function ensureManagerInOrg(orgId: string, managerId: string): Promise<void> {
  const m = await prisma.resource.findFirst({ where: { id: managerId, orgId } });
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
    const { managerId, ...rest } = data;
    if (managerId) await ensureManagerInOrg(orgId, managerId);
    return prisma.team.create({
      data: {
        ...rest,
        orgId,
        managerId: managerId ?? null,
      },
      include: teamInclude,
    });
  },

  async update(orgId: string, id: string, data: UpdateTeamInput) {
    await this.getById(orgId, id);
    const { managerId, ...rest } = data;
    if (managerId) await ensureManagerInOrg(orgId, managerId);
    const patch: Prisma.TeamUpdateInput = { ...rest };
    if (managerId !== undefined) {
      patch.manager = managerId ? { connect: { id: managerId } } : { disconnect: true };
    }
    return prisma.team.update({ where: { id }, data: patch, include: teamInclude });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.team.delete({ where: { id } });
  },
};
