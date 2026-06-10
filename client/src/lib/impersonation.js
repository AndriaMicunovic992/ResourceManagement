import { api } from './api';
import { startImpersonation, stopImpersonation } from './auth';

/**
 * Start "view as" for a member: fetch a short-lived read-only token from the
 * server, stash the admin's own token, then reload into the target's view.
 * LandingRedirect will route to the right home page for the target's role.
 */
export async function viewAs(userId, adminName) {
  const res = await api.impersonate(userId);
  startImpersonation(res.token, adminName, res.target);
  window.location.replace('/');
}

/** Restore the admin session and reload. */
export function stopViewingAs() {
  stopImpersonation();
  window.location.replace('/');
}
