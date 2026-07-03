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

/** Local Y-M-D date and hour of an instant in a timezone (DST-safe via Intl). */
function localDateHour(d: Date, timeZone: string): { date: string; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    let hour = parseInt(get('hour'), 10);
    if (hour === 24) hour = 0; // some ICU builds render midnight as "24"
    return { date: `${get('year')}-${get('month')}-${get('day')}`, hour };
  } catch {
    // Unknown timezone → fall back to UTC (always valid).
    return localDateHour(d, 'UTC');
  }
}

/**
 * Time gate only: it's at/after the configured hour in the org's timezone today,
 * and we haven't sent since. Idempotent across restarts and the scheduler's
 * 30-min ticks (compares the *local* day of the last send). Cheap to check — call
 * this before computing a user's reminders so that work is skipped before the
 * hour and for the rest of the day once sent.
 */
export function isDailyPushDue(
  lastSentAt: Date | null | undefined,
  now: Date,
  hour: number = TEAMS_REMINDER_HOUR_UTC,
  timeZone: string = 'UTC'
): boolean {
  const cur = localDateHour(now, timeZone);
  if (cur.hour < hour) return false; // before the send hour, local time
  if (!lastSentAt) return true;
  return localDateHour(lastSentAt, timeZone).date !== cur.date; // not already sent today (local)
}

/**
 * Whether to send a user's digest now: it's due today (time gate) and there is at
 * least one reminder to send.
 */
export function shouldSendDigest(
  lastSentAt: Date | null | undefined,
  now: Date,
  dueCount: number
): boolean {
  return dueCount > 0 && isDailyPushDue(lastSentAt, now);
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
