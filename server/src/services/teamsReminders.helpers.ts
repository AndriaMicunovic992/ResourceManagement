// Pure helpers for pushing reminders to Microsoft Teams. No DB / SDK imports so
// they unit-test in isolation; the bot transport and scheduling live elsewhere
// (teamsBot.ts / scheduler.ts). All time math is UTC.

// A reminder as produced by reminder.service.forUser(). Kept structural so this
// file stays decoupled from the service.
export interface ReminderLike {
  type: 'oneOnOne' | 'pmUpdate' | 'clientSignal';
  resourceName: string;
  customerName?: string | null;
}

export const REMINDER_TYPES = ['oneOnOne', 'pmUpdate', 'clientSignal'] as const;

// Push the digest once per day, on or after this UTC hour (after the morning
// auto-sync, so "actuals" context is fresh).
export const TEAMS_REMINDER_HOUR_UTC = 7;

/**
 * Parse the org's comma-separated reminder-type filter. Null/empty/whitespace
 * means "all types" (returns null). Unknown tokens are ignored.
 */
export function parseReminderTypes(csv: string | null | undefined): Set<string> | null {
  if (!csv || !csv.trim()) return null;
  const known = new Set<string>(REMINDER_TYPES);
  const picked = csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => known.has(s));
  return picked.length ? new Set(picked) : null;
}

/** Keep only reminders whose type the org opted into (null filter = keep all). */
export function filterReminders<T extends { type: string }>(
  reminders: T[],
  typesCsv: string | null | undefined
): T[] {
  const allow = parseReminderTypes(typesCsv);
  if (!allow) return reminders;
  return reminders.filter((r) => allow.has(r.type));
}

/**
 * Whether to send a user's digest now: there is at least one due reminder and we
 * haven't already sent today (idempotent across restarts, like the sync guard).
 */
export function shouldSendDigest(
  lastSentAt: Date | null | undefined,
  now: Date,
  dueCount: number
): boolean {
  if (dueCount <= 0) return false;
  const runTime = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    TEAMS_REMINDER_HOUR_UTC
  );
  if (now.getTime() < runTime) return false;
  if (!lastSentAt) return true;
  return lastSentAt.getTime() < runTime;
}

function lineFor(r: ReminderLike): string {
  const who = r.resourceName || 'someone';
  const on = r.customerName ? ` on **${r.customerName}**` : '';
  switch (r.type) {
    case 'oneOnOne':
      return `• 1:1 overdue with **${who}**`;
    case 'pmUpdate':
      return `• PM update due for **${who}**${on}`;
    case 'clientSignal':
      return `• Client signal missing for **${who}**${on}`;
    default:
      return `• Reminder about **${who}**${on}`;
  }
}

/**
 * Build the Markdown body of the reminder DM. Returns '' for an empty list so the
 * caller can skip sending.
 */
export function formatDigest(reminders: ReminderLike[]): string {
  if (!reminders.length) return '';
  const n = reminders.length;
  const header = `**You have ${n} open reminder${n === 1 ? '' : 's'}:**`;
  return [header, ...reminders.map(lineFor)].join('\n\n');
}
