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

// Teams-facing reminder groups. The engine emits three types, but a client
// signal and a PM update are the same "PM review" duty for the same person, so
// Teams collapses them into one group — one toggle in Settings, one digest line.
export const REMINDER_GROUPS = ['oneOnOne', 'pmReview'] as const;
export type ReminderGroup = (typeof REMINDER_GROUPS)[number];

/** Map an engine reminder type to its Teams group (null = unknown → dropped). */
export function groupOf(type: string): ReminderGroup | null {
  if (type === 'oneOnOne') return 'oneOnOne';
  if (type === 'pmUpdate' || type === 'clientSignal') return 'pmReview';
  return null;
}

// Push the digest once per day, on or after this UTC hour (after the morning
// auto-sync, so "actuals" context is fresh).
export const TEAMS_REMINDER_HOUR_UTC = 7;

/**
 * Parse the org's comma-separated reminder filter into a set of Teams groups.
 * Null/empty/whitespace means "all groups" (returns null). Accepts both the
 * group keys (oneOnOne, pmReview) and the legacy engine types (pmUpdate /
 * clientSignal → pmReview) so settings saved before the merge keep working.
 * Unknown tokens are ignored.
 */
export function parseReminderTypes(csv: string | null | undefined): Set<ReminderGroup> | null {
  if (!csv || !csv.trim()) return null;
  const picked = new Set<ReminderGroup>();
  for (const tok of csv.split(',').map((s) => s.trim())) {
    if (tok === 'oneOnOne') picked.add('oneOnOne');
    else if (tok === 'pmReview' || tok === 'pmUpdate' || tok === 'clientSignal') picked.add('pmReview');
  }
  return picked.size ? picked : null;
}

/** Keep only reminders whose Teams group the org opted into (null = keep all). */
export function filterReminders<T extends { type: string }>(
  reminders: T[],
  typesCsv: string | null | undefined
): T[] {
  const allow = parseReminderTypes(typesCsv);
  if (!allow) return reminders;
  return reminders.filter((r) => {
    const g = groupOf(r.type);
    return g !== null && allow.has(g);
  });
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
    // A PM update and a client signal are the same PM-review duty — one wording.
    case 'pmUpdate':
    case 'clientSignal':
      return `• PM review due for **${who}**${on}`;
    default:
      return `• Reminder about **${who}**${on}`;
  }
}

/**
 * Build the Markdown body of the reminder DM. Returns '' for an empty list so the
 * caller can skip sending. Collapses to one line per (group, person, customer),
 * so a PM update and a client signal for the same person never both appear.
 */
export function formatDigest(reminders: ReminderLike[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const r of reminders) {
    const key = `${groupOf(r.type) ?? r.type}|${r.resourceName}|${r.customerName ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(lineFor(r));
  }
  if (!lines.length) return '';
  const n = lines.length;
  const header = `**You have ${n} open reminder${n === 1 ? '' : 's'}:**`;
  return [header, ...lines].join('\n\n');
}
