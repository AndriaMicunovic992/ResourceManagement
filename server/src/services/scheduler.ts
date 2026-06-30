// In-process background scheduler. The app runs as a single long-lived process
// (Railway, restart-on-failure), so a wake-up timer + a DB-recorded last-run is
// enough to drive a daily job idempotently — no external cron or job queue.
//
// Assumes a SINGLE instance. If the deployment is ever scaled to multiple
// instances, each would tick independently; add leader-election or move to an
// external trigger (a protected endpoint hit by a platform cron) before then.
// Set DISABLE_SCHEDULER=true to turn it off (e.g. when using an external trigger).
import { prisma } from '../db/prisma.js';
import { integrationService } from './integration.service.js';
import { computeUpdatedFrom, isDailySyncDue } from './scheduler.helpers.js';

// How often the scheduler wakes to check whether any job is due.
const TICK_MS = 30 * 60 * 1000; // 30 minutes
// Small delay after boot before the first check, so startup isn't competing with
// request traffic.
const KICKOFF_MS = 15 * 1000;

interface Logger {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

let tickTimer: ReturnType<typeof setInterval> | null = null;
let kickoffTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

/**
 * Run the daily Jira/Tempo delta sync for every org whose connection is enabled,
 * has auto-sync on, has a Tempo token, and is due today. One org's failure is
 * isolated — it's recorded and the loop continues.
 */
async function runDueAutoSyncs(log: Logger): Promise<void> {
  const now = new Date();
  const connections = await prisma.jiraConnection.findMany({
    where: { enabled: true, autoSyncEnabled: true, tempoApiToken: { not: null } },
    select: { orgId: true, worklogSyncedAt: true, lastAutoSyncAt: true },
  });

  for (const c of connections) {
    if (!isDailySyncDue(c.lastAutoSyncAt, now)) continue;
    const updatedFrom = computeUpdatedFrom(c.worklogSyncedAt, now);
    try {
      const r = await integrationService.syncHours(c.orgId, updatedFrom);
      await prisma.jiraConnection.update({
        where: { orgId: c.orgId },
        data: { lastAutoSyncAt: new Date(), lastAutoSyncStatus: 'ok', lastAutoSyncError: null },
      });
      log.info(
        { orgId: c.orgId, updatedFrom, worklogs: r.worklogs, hours: r.hours },
        'auto-sync completed'
      );
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      // Best-effort status write; never let it mask the original failure.
      await prisma.jiraConnection
        .update({
          where: { orgId: c.orgId },
          data: { lastAutoSyncAt: new Date(), lastAutoSyncStatus: 'error', lastAutoSyncError: message },
        })
        .catch(() => {});
      log.error({ orgId: c.orgId, err: message }, 'auto-sync failed');
    }
  }
}

async function tick(log: Logger): Promise<void> {
  if (inFlight) return; // a slow run is still going — skip this wake-up
  inFlight = true;
  try {
    await runDueAutoSyncs(log);
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'scheduler tick failed');
  } finally {
    inFlight = false;
  }
}

/**
 * Start the background scheduler. Returns a stop function to clear the timers
 * (called on graceful shutdown). No-op (returns a stop fn anyway) when disabled.
 */
export function startScheduler(log: Logger): () => void {
  if (process.env.DISABLE_SCHEDULER === 'true') {
    log.info({}, 'background scheduler disabled (DISABLE_SCHEDULER=true)');
    return () => {};
  }
  kickoffTimer = setTimeout(() => void tick(log), KICKOFF_MS);
  tickTimer = setInterval(() => void tick(log), TICK_MS);
  log.info({ tickMinutes: TICK_MS / 60000 }, 'background scheduler started');

  return () => {
    if (kickoffTimer) clearTimeout(kickoffTimer);
    if (tickTimer) clearInterval(tickTimer);
    kickoffTimer = null;
    tickTimer = null;
  };
}
