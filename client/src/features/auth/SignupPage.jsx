import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup({ name, email, password, orgName });
      navigate('/planner');
    } catch (err) {
      setError(err.message || 'Signup failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-primary-bg flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-card border border-border p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-text mb-1">databob</h1>
        <p className="text-xs text-text-mid mb-6">Create your account & organization</p>
        {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-text-mid mb-1">Your Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-text-mid mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-text-mid mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary" />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-semibold text-text-mid mb-1">Organization Name</label>
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text outline-none focus:border-primary"
              placeholder="e.g. databob" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </Button>
        </form>
        <p className="text-xs text-text-mid text-center mt-4">
          Already have an account? <Link to="/login" className="text-primary font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
