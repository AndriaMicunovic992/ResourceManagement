import { prisma } from '../db/prisma.js';
import { reminderService } from './reminder.service.js';
import { computeVisibility } from './visibility.service.js';
import { sendProactiveMessage, buildReminderText } from './teamsTransport.js';
import { filterReminders, isDailyPushDue } from './teamsReminders.helpers.js';
import { systemRoleDef, LEGACY_ROLE_LEVEL } from '../lib/permissions.js';

interface Logger {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

/**
 * Deliver the in-app reminders as Teams DMs, mirroring exactly what each person
 * sees on the People page (reminderService.forUser + their visibility scope).
 *
 * - Scheduled: called each scheduler tick with no orgId — sends once a day (the
 *   isDailyPushDue gate, per user) to everyone who has something due.
 * - Manual: called with an orgId + force=true from the "send now" button — sends
 *   immediately, ignoring the time-of-day gate (still only when there's something
 *   to send).
 * One person's failure is isolated so the rest still go out.
 */
export async function runReminderPush(opts: {
  now: Date;
  orgId?: string;
  force?: boolean;
  log?: Logger;
}): Promise<{ orgs: number; sent: number }> {
  const { now, orgId, force = false, log } = opts;

  const orgs = await prisma.organization.findMany({
    where: {
      teamsRemindersEnabled: true,
      teamsConnection: { is: { botAppId: { not: null }, botAppPassword: { not: null } } },
      ...(orgId ? { id: orgId } : {}),
    },
    select: { id: true, teamsReminderTypes: true, teamsReminderMessage: true },
  });

  let sent = 0;
  for (const org of orgs) {
    // Role → level map for computing each member's visibility (same tiering the
    // request path uses: owner/admin → all, member → team, viewer → own).
    const roles = await prisma.role.findMany({ where: { orgId: org.id }, select: { key: true, level: true } });
    const roleLevel = new Map(roles.map((r) => [r.key, r.level]));

    // Connected members: linked to a Teams conversation AND to a Microsoft identity.
    const members = await prisma.orgMember.findMany({
      where: { orgId: org.id, user: { microsoftId: { not: null }, teamsLink: { isNot: null } } },
      select: { userId: true, role: true, user: { select: { teamsLink: { select: { lastSentAt: true } } } } },
    });

    for (const m of members) {
      try {
        const lastSentAt = m.user.teamsLink?.lastSentAt ?? null;
        if (!force && !isDailyPushDue(lastSentAt, now)) continue; // cheap gate before the work

        const level = roleLevel.get(m.role) ?? systemRoleDef(m.role)?.level ?? LEGACY_ROLE_LEVEL[m.role] ?? 1;
        const scope = await computeVisibility(org.id, m.userId, level);
        const reminders = filterReminders(
          await reminderService.forUser(org.id, m.userId, scope),
          org.teamsReminderTypes
        );
        if (reminders.length === 0) continue; // nothing due for this person

        await sendProactiveMessage(org.id, m.userId, buildReminderText(org.teamsReminderMessage, reminders));
        await prisma.teamsUserLink.update({ where: { userId: m.userId }, data: { lastSentAt: new Date() } });
        sent++;
      } catch (err) {
        log?.error(
          { orgId: org.id, userId: m.userId, err: (err instanceof Error ? err.message : String(err)).slice(0, 300) },
          'teams reminder push failed for user'
        );
      }
    }
  }
  return { orgs: orgs.length, sent };
}
