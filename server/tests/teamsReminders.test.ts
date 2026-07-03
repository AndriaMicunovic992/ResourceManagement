import { describe, it, expect } from 'vitest';
import {
  parseReminderTypes,
  filterReminders,
  shouldSendDigest,
  isDailyPushDue,
  formatDigest,
  TEAMS_REMINDER_HOUR_UTC,
  type ReminderLike,
} from '../src/services/teamsReminders.helpers.js';

describe('parseReminderTypes', () => {
  it('treats null/empty/whitespace as "all" (null)', () => {
    expect(parseReminderTypes(null)).toBeNull();
    expect(parseReminderTypes('')).toBeNull();
    expect(parseReminderTypes('   ')).toBeNull();
  });
  it('parses a known subset and ignores junk', () => {
    expect(parseReminderTypes('oneOnOne, pmUpdate')).toEqual(new Set(['oneOnOne', 'pmUpdate']));
    expect(parseReminderTypes('oneOnOne, nonsense')).toEqual(new Set(['oneOnOne']));
  });
  it('returns null when nothing valid remains', () => {
    expect(parseReminderTypes('nope,bad')).toBeNull();
  });
});

describe('filterReminders', () => {
  const rs = [
    { type: 'oneOnOne' },
    { type: 'pmUpdate' },
    { type: 'clientSignal' },
  ];
  it('keeps everything when no filter is set', () => {
    expect(filterReminders(rs, null)).toHaveLength(3);
  });
  it('keeps only opted-in types', () => {
    expect(filterReminders(rs, 'pmUpdate').map((r) => r.type)).toEqual(['pmUpdate']);
  });
});

describe('shouldSendDigest', () => {
  const at = (iso: string) => new Date(iso);
  it('never sends when there is nothing due', () => {
    expect(shouldSendDigest(null, at('2026-06-25T09:00:00Z'), 0)).toBe(false);
  });
  it('does not send before the daily push hour', () => {
    expect(shouldSendDigest(null, at('2026-06-25T06:00:00Z'), 3)).toBe(false);
  });
  it('sends once when due and not yet sent today', () => {
    expect(shouldSendDigest(null, at('2026-06-25T08:00:00Z'), 1)).toBe(true);
  });
  it('does not double-send the same day', () => {
    const now = at('2026-06-25T09:00:00Z');
    expect(shouldSendDigest(at('2026-06-25T07:30:00Z'), now, 2)).toBe(false);
  });
  it('sends again the next day', () => {
    const now = at('2026-06-25T08:00:00Z');
    expect(shouldSendDigest(at('2026-06-24T08:00:00Z'), now, 2)).toBe(true);
  });
  it('treats the push hour boundary as eligible', () => {
    const now = new Date(Date.UTC(2026, 5, 25, TEAMS_REMINDER_HOUR_UTC));
    expect(shouldSendDigest(null, now, 1)).toBe(true);
  });
});

describe('isDailyPushDue', () => {
  const at = (iso: string) => new Date(iso);
  it('not due before the push hour', () => {
    expect(isDailyPushDue(null, at('2026-06-25T06:00:00Z'))).toBe(false);
  });
  it('due at/after the push hour when never sent', () => {
    expect(isDailyPushDue(null, at('2026-06-25T07:30:00Z'))).toBe(true);
  });
  it('not due again once sent today', () => {
    expect(isDailyPushDue(at('2026-06-25T07:05:00Z'), at('2026-06-25T09:00:00Z'))).toBe(false);
  });
  it('due again the next day', () => {
    expect(isDailyPushDue(at('2026-06-24T07:05:00Z'), at('2026-06-25T07:05:00Z'))).toBe(true);
  });
  it('respects a custom hour + timezone (08:00 Europe/Zurich, summer = UTC+2)', () => {
    // 05:30Z = 07:30 in Zurich → before 08:00
    expect(isDailyPushDue(null, at('2026-06-25T05:30:00Z'), 8, 'Europe/Zurich')).toBe(false);
    // 06:30Z = 08:30 in Zurich → at/after 08:00
    expect(isDailyPushDue(null, at('2026-06-25T06:30:00Z'), 8, 'Europe/Zurich')).toBe(true);
    // already sent earlier the same Zurich day
    expect(
      isDailyPushDue(at('2026-06-25T06:35:00Z'), at('2026-06-25T09:00:00Z'), 8, 'Europe/Zurich')
    ).toBe(false);
  });
});

describe('formatDigest', () => {
  it('returns empty string for no reminders', () => {
    expect(formatDigest([])).toBe('');
  });
  it('renders a header and a line per reminder type', () => {
    const reminders: ReminderLike[] = [
      { type: 'oneOnOne', resourceName: 'Sem' },
      { type: 'pmUpdate', resourceName: 'Luka', customerName: 'CH Media' },
      { type: 'clientSignal', resourceName: 'Nikola', customerName: 'CH Media' },
    ];
    const body = formatDigest(reminders);
    expect(body).toContain('3 open reminders');
    expect(body).toContain('1:1 overdue with **Sem**');
    expect(body).toContain('PM update due for **Luka** on **CH Media**');
    expect(body).toContain('Client signal missing for **Nikola** on **CH Media**');
  });
  it('uses the singular for a single reminder', () => {
    expect(formatDigest([{ type: 'oneOnOne', resourceName: 'Sem' }])).toContain('1 open reminder:');
  });
});
