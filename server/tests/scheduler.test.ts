import { describe, it, expect } from 'vitest';
import {
  computeUpdatedFrom,
  isDailySyncDue,
  DAILY_SYNC_HOUR_UTC,
} from '../src/services/scheduler.helpers.js';

describe('isDailySyncDue', () => {
  const at = (iso: string) => new Date(iso);

  it('is not due before the daily run hour', () => {
    // 04:00 UTC, run hour is 05:00 — too early, even if never run.
    expect(isDailySyncDue(null, at('2026-06-25T04:00:00Z'))).toBe(false);
  });

  it('is due at/after the run hour when it has never run', () => {
    expect(isDailySyncDue(null, at('2026-06-25T05:00:00Z'))).toBe(true);
    expect(isDailySyncDue(null, at('2026-06-25T06:00:00Z'))).toBe(true);
  });

  it('is not due again once it has run today (idempotent across restarts)', () => {
    const now = at('2026-06-25T06:00:00Z');
    const ranToday = at('2026-06-25T05:30:00Z');
    expect(isDailySyncDue(ranToday, now)).toBe(false);
  });

  it('is due again the next day', () => {
    const now = at('2026-06-25T06:00:00Z');
    const ranYesterday = at('2026-06-24T06:00:00Z');
    expect(isDailySyncDue(ranYesterday, now)).toBe(true);
  });

  it('treats the run hour boundary as due', () => {
    const now = new Date(Date.UTC(2026, 5, 25, DAILY_SYNC_HOUR_UTC));
    expect(isDailySyncDue(null, now)).toBe(true);
  });
});

describe('computeUpdatedFrom', () => {
  it('re-pulls a few days before the last cursor', () => {
    // worklogSyncedAt 2026-06-20 → 3-day overlap → 2026-06-17
    const from = computeUpdatedFrom(new Date('2026-06-20T10:00:00Z'), new Date('2026-06-25T06:00:00Z'));
    expect(from).toBe('2026-06-17');
  });

  it('backfills a wider window on the first run (no cursor)', () => {
    // now 2026-06-25, 30-day backfill → 2026-05-26
    const from = computeUpdatedFrom(null, new Date('2026-06-25T06:00:00Z'));
    expect(from).toBe('2026-05-26');
  });

  it('returns a YYYY-MM-DD string', () => {
    const from = computeUpdatedFrom(new Date('2026-01-02T00:00:00Z'), new Date('2026-06-25T06:00:00Z'));
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
