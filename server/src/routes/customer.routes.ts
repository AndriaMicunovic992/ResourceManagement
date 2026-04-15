import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { customerService } from '../services/customer.service.js';
import { customerPerformanceService } from '../services/customerPerformance.service.js';
import { canViewCustomer } from '../services/customerAccess.service.js';
import { assertNoViewerResources } from '../services/visibility.service.js';
import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema.js';
import {
  customerDetailQuerySchema,
  customerTrendQuerySchema,
} from '../schemas/customerDetail.schema.js';
import { listLogsQuerySchema } from '../schemas/log.schema.js';
import { logInclude } from '../services/log.service.js';
import { requireRole } from '../middleware/requireRole.js';
import { NotFoundError } from '../utils/errors.js';

function parseBoundaryDate(value: string, endOfDay: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    return new Date(`${value}${suffix}`);
  }
  return new Date(value);
}

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/customers', async (req) => {
    const list = await customerService.list(req.orgId);
    if (req.visibility.isAdmin) return list;
    return list.filter((c) => req.visibility.visibleCustomerIds.has(c.id));
  });

  app.get('/customers/:id/detail', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!canViewCustomer(req.visibility, id)) {
      return reply.status(404).send({ error: 'Customer not found' });
    }
    const customer = await prisma.customer.findFirst({
      where: { id, orgId: req.orgId },
      include: {
        projects: {
          include: { needs: { include: { assignments: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!customer) {
      return reply.status(404).send({ error: 'Customer not found' });
    }
    let responsiblePerson: { id: string; name: string } | null = null;
    if (customer.responsiblePersonId) {
      const r = await prisma.resource.findFirst({
        where: { id: customer.responsiblePersonId, orgId: req.orgId },
        select: { id: true, name: true },
      });
      responsiblePerson = r ?? null;
    }
    return { customer, responsiblePerson };
  });

  app.get('/customers/:id/activity', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!canViewCustomer(req.visibility, id)) {
      return reply.status(404).send({ error: 'Customer not found' });
    }
    const filters = listLogsQuerySchema.parse(req.query);

    const projects = await prisma.project.findMany({
      where: { orgId: req.orgId, customerId: id },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    const orClauses: Prisma.LogWhereInput[] = [{ customerId: id }];
    if (projectIds.length > 0) {
      orClauses.push({ customerId: null, projectId: { in: projectIds } });
    }

    const where: Prisma.LogWhereInput = {
      orgId: req.orgId,
      OR: orClauses,
    };
    if (filters.kind) where.kind = filters.kind;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.from || filters.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (filters.from) createdAt.gte = parseBoundaryDate(filters.from, false);
      if (filters.to) createdAt.lte = parseBoundaryDate(filters.to, true);
      where.createdAt = createdAt;
    }
    return prisma.log.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 200,
      include: logInclude,
    });
  });

  app.get('/customers/:id/performance/overall', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!canViewCustomer(req.visibility, id)) {
      return reply.status(404).send({ error: 'Customer not found' });
    }
    const filters = customerDetailQuerySchema.parse(req.query);
    try {
      return await customerPerformanceService.overall(req.orgId, id, filters);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: 'Customer not found' });
      }
      throw err;
    }
  });

  app.get('/customers/:id/performance/per-person', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!canViewCustomer(req.visibility, id)) {
      return reply.status(404).send({ error: 'Customer not found' });
    }
    const filters = customerDetailQuerySchema.parse(req.query);
    try {
      return await customerPerformanceService.perPerson(req.orgId, id, filters);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: 'Customer not found' });
      }
      throw err;
    }
  });

  app.get('/customers/:id/performance/trend', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!canViewCustomer(req.visibility, id)) {
      return reply.status(404).send({ error: 'Customer not found' });
    }
    const query = customerTrendQuerySchema.parse(req.query);
    const bucket = query.bucket ?? 'month';
    try {
      return await customerPerformanceService.trend(
        req.orgId,
        id,
        { from: query.from, to: query.to },
        bucket
      );
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: 'Customer not found' });
      }
      throw err;
    }
  });

  app.post('/customers', { preHandler: requireRole('admin') }, async (req) => {
    const data = createCustomerSchema.parse(req.body);
    if (data.responsiblePersonId) {
      await assertNoViewerResources(req.orgId, [data.responsiblePersonId]);
    }
    return customerService.create(req.orgId, data);
  });

  app.patch('/customers/:id', { preHandler: requireRole('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateCustomerSchema.parse(req.body);
    if (data.responsiblePersonId) {
      await assertNoViewerResources(req.orgId, [data.responsiblePersonId]);
    }
    return customerService.update(req.orgId, id, data);
  });

  app.delete('/customers/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await customerService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
