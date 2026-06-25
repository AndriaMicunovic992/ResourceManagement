// Pure helpers for the background scheduler. Kept free of any DB/service imports
// so they can be unit-tested in isolation (the orchestration lives in
// scheduler.ts). All time math is in UTC to stay deployment-timezone-agnostic.

// Nightly auto-sync fires once per day, on or after this UTC hour.
export const DAILY_SYNC_HOUR_UTC = 5;
// Re-pull a few days before the last cursor so worklogs edited after the last
// sync (Tempo lets you back-date/edit) still get picked up.
export const SYNC_OVERLAP_DAYS = 3;
// The very first automatic sync (no cursor yet) pulls this far back.
export const SYNC_BACKFILL_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * The `updatedFrom` (YYYY-MM-DD) an automatic sync should request: a few days
 * before the last successful pull, or a backfill window if it never ran.
 */
export function computeUpdatedFrom(worklogSyncedAt: Date | null | undefined, now: Date): string {
  const from = worklogSyncedAt
    ? new Date(worklogSyncedAt.getTime() - SYNC_OVERLAP_DAYS * DAY_MS)
    : new Date(now.getTime() - SYNC_BACKFILL_DAYS * DAY_MS);
  return from.toISOString().slice(0, 10);
}

/**
 * Whether the daily auto-sync is due now: we're at/after today's run hour and we
 * haven't already run on or after it. Idempotent across restarts — a process
 * that boots, runs, and restarts the same day won't sync twice.
 */
export function isDailySyncDue(lastAutoSyncAt: Date | null | undefined, now: Date): boolean {
  const runTime = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    DAILY_SYNC_HOUR_UTC
  );
  if (now.getTime() < runTime) return false; // before today's scheduled hour
  if (!lastAutoSyncAt) return true; // never run
  return lastAutoSyncAt.getTime() < runTime; // last run was before today's hour
}
