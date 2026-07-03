import { describe, it, expect } from 'vitest';
import { buildReminderText } from '../src/services/teamsTransport.js';

describe('buildReminderText', () => {
  const one = [{ type: 'oneOnOne' as const, resourceName: 'Sem' }];

  it('uses the default intro when none is set', () => {
    const t = buildReminderText(null, one);
    expect(t).toContain('Here are your open items in databob:');
    expect(t).toContain('1:1 overdue with **Sem**');
  });

  it('uses a custom intro when provided', () => {
    const t = buildReminderText('Hallo! Deine offenen Punkte:', one);
    expect(t.startsWith('Hallo! Deine offenen Punkte:')).toBe(true);
    expect(t).not.toContain('Here are your open items');
  });

  it('returns just the intro when there are no reminders', () => {
    expect(buildReminderText('Nothing due:', [])).toBe('Nothing due:');
  });

  it('falls back to the default intro for a blank custom intro', () => {
    expect(buildReminderText('   ', [])).toBe('Here are your open items in databob:');
  });
});
