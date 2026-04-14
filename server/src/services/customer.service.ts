import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../schemas/customer.schema.js';

async function ensureResourceInOrg(orgId: string, resourceId: string): Promise<void> {
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
  if (!resource) throw new NotFoundError('Responsible person not found');
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
    if (data.responsiblePersonId) await ensureResourceInOrg(orgId, data.responsiblePersonId);
    return prisma.customer.create({
      data: {
        name: data.name,
        status: data.status,
        responsiblePersonId: data.responsiblePersonId ?? null,
        orgId,
      },
    });
  },

  async update(orgId: string, id: string, data: UpdateCustomerInput) {
    await this.getById(orgId, id);
    if (data.responsiblePersonId) await ensureResourceInOrg(orgId, data.responsiblePersonId);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.status !== undefined) patch.status = data.status;
    if (data.responsiblePersonId !== undefined) {
      patch.responsiblePersonId = data.responsiblePersonId ?? null;
    }
    return prisma.customer.update({ where: { id }, data: patch });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.customer.delete({ where: { id } });
  },
};
