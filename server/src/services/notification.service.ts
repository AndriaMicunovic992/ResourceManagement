import { prisma } from '../db/prisma.js';
import { reminderService } from './reminder.service.js';
import type { VisibilityScope } from './visibility.service.js';

const REPLY_WINDOW_DAYS = 30;

/**
 * Aggregates the user's notification feed for the bell in the header:
 *  - replies: new comments by others on threads the user authored or joined
 *  - reviews: performance evaluations awaiting this user (self-assessment or,
 *    as the responsible person, the responsible review)
 *  - reminders: cadence reminders (overdue 1:1s, stale PM updates, missing
 *    signals) from the existing engine
 */
export const notificationService = {
  async forUser(orgId: string, userId: string, scope: VisibilityScope) {
    const cutoff = new Date(Date.now() - REPLY_WINDOW_DAYS * 86400000);

    // --- Replies on my threads ---
    const [authored, commented] = await Promise.all([
      prisma.log.findMany({ where: { orgId, authorUserId: userId }, select: { id: true } }),
      prisma.logComment.findMany({
        where: { orgId, authorUserId: userId },
        select: { logId: true },
        distinct: ['logId'],
      }),
    ]);
    const logIds = [...new Set([...authored.map((l) => l.id), ...commented.map((c) => c.logId)])];

    let replies: unknown[] = [];
    if (logIds.length > 0) {
      const comments = await prisma.logComment.findMany({
        where: {
          orgId,
          logId: { in: logIds },
          authorUserId: { not: userId },
          createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: {
          authorUser: { select: { name: true, email: true } },
          log: { select: { id: true, resourceId: true, kind: true, content: true } },
        },
      });
      replies = comments.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        content: c.content,
        author: c.authorUser?.name || c.authorUser?.email || 'Someone',
        resourceId: c.log?.resourceId ?? null,
        logKind: c.log?.kind ?? null,
        excerpt: (c.log?.content || '').slice(0, 70),
      }));
    }

    // --- Performance review reminders ---
    const reviews: unknown[] = [];
    const myResource = await prisma.resource.findFirst({
      where: { orgId, userId },
      select: { id: true },
    });
    if (myResource) {
      const drafts = await prisma.evaluation.findMany({
        where: { orgId, resourceId: myResource.id, state: 'draft' },
        select: { id: true, customerNameSnapshot: true, periodEnd: true },
        orderBy: { periodEnd: 'desc' },
      });
      for (const e of drafts) {
        reviews.push({
          id: e.id,
          kind: 'self',
          resourceId: myResource.id,
          title: 'Your self-assessment is due',
          sub: e.customerNameSnapshot,
        });
      }
    }
    const responsibleEvals = await prisma.evaluation.findMany({
      where: {
        orgId,
        state: 'employee_submitted',
        OR: [
          { customer: { responsibleUserId: userId } },
          { project: { responsibleUserId: userId } },
        ],
      },
      include: { resource: { select: { id: true, name: true } } },
      orderBy: { periodEnd: 'desc' },
    });
    for (const e of responsibleEvals) {
      reviews.push({
        id: e.id,
        kind: 'responsible',
        resourceId: e.resource?.id ?? null,
        title: `Review due · ${e.resource?.name ?? 'someone'}`,
        sub: e.customerNameSnapshot,
      });
    }

    // --- Cadence reminders (1:1s, PM updates, signals) ---
    const reminders = await reminderService.forUser(orgId, userId, scope);

    return { replies, reviews, reminders };
  },
};
