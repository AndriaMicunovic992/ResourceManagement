import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateTeamInput, UpdateTeamInput } from '../schemas/team.schema.js';

export const teamService = {
  async list(orgId: string) {
    return prisma.team.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const team = await prisma.team.findFirst({ where: { id, orgId } });
    if (!team) throw new NotFoundError('Team not found');
    return team;
  },

  async create(orgId: string, data: CreateTeamInput) {
    return prisma.team.create({ data: { ...data, orgId } });
  },

  async update(orgId: string, id: string, data: UpdateTeamInput) {
    await this.getById(orgId, id);
    return prisma.team.update({ where: { id }, data });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.team.delete({ where: { id } });
  },
};
