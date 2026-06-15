import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../schemas/customer.schema.js';

async function ensureUserInOrg(orgId: string, userId: string): Promise<void> {
  const member = await prisma.orgMember.findFirst({ where: { orgId, userId } });
  if (!member) throw new NotFoundError('Responsible person not found');
}

export const customerService = {
  async list(orgId: string) {
    return prisma.customer.findMany({
      where: { orgId },
      include: { projects: { include: { needs: { include: { assignments: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const customer = await prisma.customer.findFirst({ where: { id, orgId } });
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  },

  async create(orgId: string, data: CreateCustomerInput) {
    if (data.responsibleUserId) await ensureUserInOrg(orgId, data.responsibleUserId);
    return prisma.customer.create({
      data: {
        name: data.name,
        status: data.status,
        responsibleUserId: data.responsibleUserId ?? null,
        orgId,
      },
    });
  },

  async update(orgId: string, id: string, data: UpdateCustomerInput) {
    await this.getById(orgId, id);
    if (data.responsibleUserId) await ensureUserInOrg(orgId, data.responsibleUserId);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.status !== undefined) patch.status = data.status;
    if (data.responsibleUserId !== undefined) {
      patch.responsibleUserId = data.responsibleUserId ?? null;
    }
    return prisma.customer.update({ where: { id }, data: patch });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.customer.delete({ where: { id } });
  },
};
