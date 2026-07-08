import { FastifyPluginAsync } from 'fastify';
import { canView } from '../lib/permissions.js';
import { resourceService } from '../services/resource.service.js';
import { createResourceSchema, updateResourceSchema, setAbsencesSchema } from '../schemas/resource.schema.js';
import { requireRole } from '../middleware/requireRole.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  assertCanViewPerson,
  assertManagerUsersAllowed,
} from '../services/visibility.service.js';
import { NotFoundError } from '../utils/errors.js';
import { prisma } from '../db/prisma.js';
import { reminderService } from '../services/reminder.service.js';
import { notificationService } from '../services/notification.service.js';
import { z } from 'zod';

const dismissReminderSchema = z.object({
  type: z.enum(['oneOnOne', 'pmUpdate', 'clientSignal']),
  resourceId: z.string().min(1).max(40),
  customerId: z.string().max(40).optional().nullable(),
});

export const resourceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/resources', async (req) => {
    if (!canView(req.permissions, 'people')) return [];
    const list = await resourceService.list(req.orgId);
    if (req.visibility.isAdmin) return list;
    return list.filter((r) => req.visibility.visiblePersonIds.has(r.id));
  });

  app.get('/resources/:id', async (req) => {
    const { id } = req.params as { id: string };
    assertCanViewPerson(req.visibility, id);
    const resource = await resourceService.getById(req.orgId, id);
    if (!resource) throw new NotFoundError('Resource not found');
    return resource;
  });

  app.get('/me/resource', async (req) => {
    return resourceService.getByUserId(req.orgId, req.userId);
  });

  /**
   * Returns the current user's own assignments, enriched with the minimal
   * need/project/customer info needed to render the allocation view. This
   * avoids broadening customer/project visibility for viewers and members
   * who happen to be assigned to something they don't otherwise own.
   */
  app.get('/me/allocations', async (req) => {
    const selfId = req.visibility.selfResourceId;
    if (!selfId) return { resource: null, assignments: [] };

    const resource = await prisma.resource.findFirst({
      where: { id: selfId, orgId: req.orgId },
      select: { id: true, name: true, capacity: true },
    });
    if (!resource) return { resource: null, assignments: [] };

    const assignments = await prisma.assignment.findMany({
      where: { orgId: req.orgId, resourceId: selfId },
      select: {
        id: true,
        monthAllocations: true,
        need: {
          select: {
            id: true,
            domain: true,
            role: true,
            seniority: true,
            status: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                customer: { select: { id: true, name: true, status: true } },
              },
            },
          },
        },
      },
    });

    return { resource, assignments };
  });

  // What's due for me: overdue 1:1s (managed people), missing monthly client
  // signals and stale PM updates (responsible customers). Derived on request
  // from org cadence settings — nothing stored.
  app.get('/me/reminders', async (req) => {
    return reminderService.forUser(req.orgId, req.userId, req.visibility);
  });

  // Notification feed for the header bell: thread replies + review reminders +
  // cadence reminders.
  app.get('/me/notifications', async (req) => {
    return notificationService.forUser(req.orgId, req.userId, req.visibility);
  });

  // Snooze one reminder item (e.g. the person was on leave). Cadence reminders
  // re-arm after another cadence window; monthly signals re-arm next month.
  app.post('/me/reminders/dismiss', async (req, reply) => {
    const body = dismissReminderSchema.parse(req.body);
    await reminderService.dismiss(req.orgId, req.userId, body);
    return reply.status(204).send();
  });

  app.get('/me/visibility', async (req) => {
    const v = req.visibility;
    return {
      role: v.role,
      isAdmin: v.isAdmin,
      permissions: req.permissions,
      selfResourceId: v.selfResourceId,
      managedPersonIds: [...v.managedPersonIds],
      responsibleCustomerIds: [...v.responsibleCustomerIds],
      responsibleProjectIds: [...v.responsibleProjectIds],
      visiblePersonIds: [...v.visiblePersonIds],
      visibleCustomerIds: [...v.visibleCustomerIds],
      visibleProjectIds: [...v.visibleProjectIds],
    };
  });

  app.post('/resources', { preHandler: requirePermission('people', 'create') }, async (req) => {
    const data = createResourceSchema.parse(req.body);
    if (data.directManagerUserIds && data.directManagerUserIds.length > 0) {
      await assertManagerUsersAllowed(req.orgId, data.directManagerUserIds);
    }
    return resourceService.create(req.orgId, data);
  });

  app.patch('/resources/:id', { preHandler: requirePermission('people', 'edit') }, async (req) => {
    const { id } = req.params as { id: string };
    const data = updateResourceSchema.parse(req.body);
    if (data.directManagerUserIds && data.directManagerUserIds.length > 0) {
      await assertManagerUsersAllowed(req.orgId, data.directManagerUserIds);
    }
    return resourceService.update(req.orgId, id, data);
  });

  // Planned absences (days off per month), entered in the planner — so the
  // gate is the planner segment, like assignments, not the people record.
  app.patch('/resources/:id/absences', { preHandler: requirePermission('planner', 'edit') }, async (req) => {
    const { id } = req.params as { id: string };
    const { months } = setAbsencesSchema.parse(req.body);
    return resourceService.setAbsences(req.orgId, id, months);
  });

  app.delete('/resources/:id', { preHandler: requirePermission('people', 'delete') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await resourceService.delete(req.orgId, id);
    return reply.status(204).send();
  });
};
