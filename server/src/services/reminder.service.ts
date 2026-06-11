import { prisma } from '../db/prisma.js';
import type { VisibilityScope } from './visibility.service.js';

/**
 * In-app reminder engine: computes what's due for the requesting user from
 * org cadence settings. Stateless — derived on request, nothing stored.
 * Phase 2 will push the same items through Teams/Outlook via Graph.
 */

export interface ReminderItem {
  type: 'oneOnOne' | 'pmUpdate' | 'clientSignal';
  resourceId: string;
  resourceName: string;
  customerId?: string;
  customerName?: string;
  /** Last relevant activity, if any. */
  lastAt?: string | null;
  daysOverdue?: number;
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export const reminderService = {
  async forUser(orgId: string, userId: string, scope: VisibilityScope): Promise<ReminderItem[]> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { oneOnOneReminderDays: true, pmLogReminderDays: true },
    });
    if (!org) return [];

    const items: ReminderItem[] = [];
    const managedIds = Array.from(scope.managedPersonIds);

    // --- Overdue 1:1s for people the user manages (direct or via team) ---
    if (org.oneOnOneReminderDays && managedIds.length > 0) {
      const people = await prisma.resource.findMany({
        where: { orgId, id: { in: managedIds } },
        select: { id: true, name: true },
      });
      const latest = await prisma.oneOnOne.groupBy({
        by: ['resourceId'],
        where: { orgId, resourceId: { in: managedIds } },
        _max: { meetingDate: true },
      });
      const latestBy = new Map(latest.map((l) => [l.resourceId, l._max.meetingDate]));
      for (const p of people) {
        const last = latestBy.get(p.id) ?? null;
        const days = daysSince(last);
        if (days === null || days >= org.oneOnOneReminderDays) {
          items.push({
            type: 'oneOnOne',
            resourceId: p.id,
            resourceName: p.name,
            lastAt: last ? last.toISOString() : null,
            daysOverdue: days === null ? undefined : days - org.oneOnOneReminderDays,
          });
        }
      }
    }

    // --- PM duties: per responsible customer × person allocated this month ---
    const responsibleCustomerIds = Array.from(scope.responsibleCustomerIds);
    if (responsibleCustomerIds.length > 0 && (org.pmLogReminderDays || true)) {
      const month = currentMonthKey();
      const customers = await prisma.customer.findMany({
        where: { orgId, id: { in: responsibleCustomerIds } },
        select: { id: true, name: true },
      });
      const projects = await prisma.project.findMany({
        where: { orgId, customerId: { in: responsibleCustomerIds } },
        select: { id: true, customerId: true },
      });
      const projByid = new Map(projects.map((p) => [p.id, p]));
      const needs = await prisma.need.findMany({
        where: { orgId, projectId: { in: projects.map((p) => p.id) } },
        select: { id: true, projectId: true },
      });
      const needToCustomer = new Map(
        needs.map((n) => [n.id, projByid.get(n.projectId)?.customerId])
      );
      const assignments = await prisma.assignment.findMany({
        where: { orgId, needId: { in: needs.map((n) => n.id) } },
        select: { resourceId: true, needId: true, monthAllocations: true },
      });

      // (customerId → set of resourceIds allocated this month)
      const allocated = new Map<string, Set<string>>();
      for (const a of assignments) {
        const alloc = (a.monthAllocations as Record<string, number> | null) || {};
        if ((alloc[month] || 0) <= 0) continue;
        const customerId = needToCustomer.get(a.needId);
        if (!customerId) continue;
        if (!allocated.has(customerId)) allocated.set(customerId, new Set());
        allocated.get(customerId)!.add(a.resourceId);
      }

      const allResourceIds = Array.from(
        new Set(Array.from(allocated.values()).flatMap((s) => Array.from(s)))
      );
      if (allResourceIds.length > 0) {
        const people = await prisma.resource.findMany({
          where: { orgId, id: { in: allResourceIds } },
          select: { id: true, name: true },
        });
        const personName = new Map(people.map((p) => [p.id, p.name]));
        const customerName = new Map(customers.map((c) => [c.id, c.name]));

        // Existing signals for the current month.
        const signals = await prisma.clientSignal.findMany({
          where: { orgId, month, customerId: { in: responsibleCustomerIds } },
          select: { customerId: true, resourceId: true },
        });
        const signalSet = new Set(signals.map((s) => `${s.customerId}|${s.resourceId}`));

        // Latest update the user logged per (customer, person).
        const sinceLogs = org.pmLogReminderDays
          ? await prisma.log.findMany({
              where: {
                orgId,
                authorUserId: userId,
                customerId: { in: responsibleCustomerIds },
                resourceId: { in: allResourceIds },
              },
              select: { customerId: true, resourceId: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            })
          : [];
        const latestLog = new Map<string, Date>();
        for (const l of sinceLogs) {
          const key = `${l.customerId}|${l.resourceId}`;
          if (!latestLog.has(key)) latestLog.set(key, l.createdAt);
        }

        // Exclude self: a PM never logs structured updates about themselves.
        for (const [customerId, resourceIds] of allocated) {
          for (const resourceId of resourceIds) {
            if (resourceId === scope.selfResourceId) continue;
            const key = `${customerId}|${resourceId}`;
            if (!signalSet.has(key)) {
              items.push({
                type: 'clientSignal',
                resourceId,
                resourceName: personName.get(resourceId) || '?',
                customerId,
                customerName: customerName.get(customerId) || '?',
              });
            }
            if (org.pmLogReminderDays) {
              const last = latestLog.get(key) ?? null;
              const days = daysSince(last);
              if (days === null || days >= org.pmLogReminderDays) {
                items.push({
                  type: 'pmUpdate',
                  resourceId,
                  resourceName: personName.get(resourceId) || '?',
                  customerId,
                  customerName: customerName.get(customerId) || '?',
                  lastAt: last ? last.toISOString() : null,
                  daysOverdue: days === null ? undefined : days - org.pmLogReminderDays,
                });
              }
            }
          }
        }
      }
    }

    return items;
  },
};
