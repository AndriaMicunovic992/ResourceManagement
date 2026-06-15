import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateProjectInput, UpdateProjectInput } from '../schemas/project.schema.js';

export const projectService = {
  async list(orgId: string, customerId?: string) {
    const where: any = { orgId };
    if (customerId) where.customerId = customerId;
    return prisma.project.findMany({
      where,
      include: {
        needs: { include: { assignments: true } },
        responsibleUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const project = await prisma.project.findFirst({ where: { id, orgId } });
    if (!project) throw new NotFoundError('Project not found');
    return project;
  },

  async create(orgId: string, data: CreateProjectInput) {
    // Verify customer belongs to org
    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, orgId } });
    if (!customer) throw new NotFoundError('Customer not found');
    // Dates are inherited from needs (spreadsheet model); seed with the
    // current month until the first need defines the real range.
    const now = new Date().toISOString().slice(0, 7);
    return prisma.project.create({
      data: { ...data, startMonth: data.startMonth || now, endMonth: data.endMonth || now, orgId },
    });
  },

  async update(orgId: string, id: string, data: UpdateProjectInput) {
    await this.getById(orgId, id);
    return prisma.project.update({ where: { id }, data });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.project.delete({ where: { id } });
  },
};
