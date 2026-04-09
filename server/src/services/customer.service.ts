import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../schemas/customer.schema.js';

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
    return prisma.customer.create({ data: { ...data, orgId } });
  },

  async update(orgId: string, id: string, data: UpdateCustomerInput) {
    await this.getById(orgId, id);
    return prisma.customer.update({ where: { id }, data });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.customer.delete({ where: { id } });
  },
};
