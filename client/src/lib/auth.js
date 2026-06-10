const TOKEN_KEY = 'databob_token';
// While impersonating, the admin's own token is stashed here so we can restore
// it when they stop. Presence of this key === "currently viewing as someone".
const IMPERSONATION_KEY = 'databob_impersonation';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

// --- Impersonation ("view as") ---

export function getImpersonation() {
  const raw = localStorage.getItem(IMPERSONATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isImpersonating() {
  return !!localStorage.getItem(IMPERSONATION_KEY);
}

/** Swap the active token for an impersonation token, stashing the admin's own. */
export function startImpersonation(impersonationToken, adminName, target) {
  const adminToken = getToken();
  localStorage.setItem(
    IMPERSONATION_KEY,
    JSON.stringify({ adminToken, adminName, target })
  );
  setToken(impersonationToken);
}

/** Restore the admin's stashed token. Returns true if there was one. */
export function stopImpersonation() {
  const imp = getImpersonation();
  localStorage.removeItem(IMPERSONATION_KEY);
  if (imp && imp.adminToken) {
    setToken(imp.adminToken);
    return true;
  }
  return false;
}

/** Drop any impersonation stash WITHOUT restoring the stashed token. Call on
 * every fresh sign-in/sign-out so a stale stash can never hijack a new session. */
export function clearImpersonation() {
  localStorage.removeItem(IMPERSONATION_KEY);
}
