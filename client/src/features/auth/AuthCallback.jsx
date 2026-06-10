import { useEffect } from 'react';
import { setToken } from '../../lib/auth';

/**
 * Lands here after the Microsoft round-trip. The server puts the result in the
 * URL fragment (#token=... or #error=...) so it never hits server logs or the
 * Referer header. We stash the token and do a full reload so AuthProvider
 * re-bootstraps the session from scratch.
 */
export default function AuthCallback() {
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(raw);
    const token = params.get('token');
    const error = params.get('error');
    if (params.get('linked')) {
      // Account-linking round-trip: the existing session token is still valid,
      // so just return to settings with a success marker.
      window.location.replace('/settings?microsoft=linked');
    } else if (token) {
      setToken(token);
      window.location.replace('/');
    } else {
      window.location.replace('/login?error=' + encodeURIComponent(error || 'sso_failed'));
    }
  }, []);

  return (
    <div className="min-h-screen bg-primary-bg flex items-center justify-center">
      <p className="text-sm text-text-mid">Signing you in…</p>
    </div>
  );
}
