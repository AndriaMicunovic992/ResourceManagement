import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api, MICROSOFT_LOGIN_URL } from '../../lib/api';
import Button from '../../components/ui/Button';

const SSO_ERRORS = {
  no_access: "You don't have access yet. Ask an admin to invite you, then sign in again.",
  sso_expired: 'That sign-in attempt expired (or the server restarted). Please try again.',
  sso_tenant: 'Your Microsoft account is outside the allowed tenant. Check ENTRA_TENANT_ID is your Directory (tenant) ID.',
  sso_verify: 'Could not verify the Microsoft token. Check ENTRA_TENANT_ID is your Directory (tenant) ID (a GUID, not a domain) and ENTRA_CLIENT_ID matches the app registration.',
  sso_exchange: 'Microsoft rejected the token exchange. Check ENTRA_CLIENT_SECRET and that ENTRA_REDIRECT_URI exactly matches the app registration.',
  sso_link_conflict: 'That Microsoft account is already linked to a different user.',
  sso_failed: 'Microsoft sign-in failed. Please try again.',
  sso_disabled: 'Microsoft sign-in is not enabled for this deployment.',
  session_expired: 'Your session ended and you were signed out. Please sign in again.',
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(SSO_ERRORS[searchParams.get('error')] || '');
  const [loading, setLoading] = useState(false);
  // Default both on until the server tells us otherwise, so the form never
  // flickers away on a slow config fetch.
  const [authConfig, setAuthConfig] = useState({ microsoftEnabled: false, localAuthEnabled: true });

  useEffect(() => {
    api.getAuthConfig().then(setAuthConfig).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Let LandingRedirect route by role (admin→planner, member→people,
      // viewer→their own person page).
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-primary-bg flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-card border border-border p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-text mb-1">databob</h1>
        <p className="text-xs text-text-mid mb-6">People Hub — Sign in</p>
        {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-4">{error}</div>}

        {authConfig.microsoftEnabled && (
          <a
            href={MICROSOFT_LOGIN_URL}
            className="flex items-center justify-center gap-2 w-full border border-border rounded-lg py-2 text-sm font-semibold text-text hover:bg-primary-light transition-colors"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </a>
        )}

        {authConfig.microsoftEnabled && authConfig.localAuthEnabled && (
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-text-light uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {authConfig.localAuthEnabled && (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-mid mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-semibold text-text-mid mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        )}

        {authConfig.localAuthEnabled && (
          <p className="text-xs text-text-mid text-center mt-4">
            Don't have an account? <Link to="/signup" className="text-primary font-semibold">Sign up</Link>
          </p>
        )}
      </div>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
