import { useState, useEffect, useCallback } from 'react';
import { useOrg } from '../../contexts/OrgContext';
import { api } from '../../lib/api';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';

const ROLES = ['viewer', 'member', 'admin'];

export default function SettingsView() {
  const { currentOrg, role, updateOrg } = useOrg();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isAdmin = role === 'admin' || role === 'owner';

  const [minDate, setMinDate] = useState(currentOrg?.minPlanningDate || '');
  const [maxDate, setMaxDate] = useState(currentOrg?.maxPlanningDate || '');
  const [dateSaving, setDateSaving] = useState(false);
  const [dateSuccess, setDateSuccess] = useState(false);

  useEffect(() => {
    setMinDate(currentOrg?.minPlanningDate || '');
    setMaxDate(currentOrg?.maxPlanningDate || '');
  }, [currentOrg]);

  const handleSaveDates = async () => {
    setDateSaving(true);
    setDateSuccess(false);
    try {
      await updateOrg({
        minPlanningDate: minDate || null,
        maxPlanningDate: maxDate || null,
      });
      setDateSuccess(true);
      setTimeout(() => setDateSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to save planning dates');
    }
    setDateSaving(false);
  };

  const loadMembers = useCallback(async () => {
    try {
      const data = await api.getMembers();
      setMembers(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await api.addMember(email.trim(), newRole);
      setEmail('');
      setNewRole('member');
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Failed to add member');
    }
    setLoading(false);
  };

  const handleRoleChange = async (memberId, role) => {
    try {
      await api.updateMemberRole(memberId, role);
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this organization?`)) return;
    try {
      await api.removeMember(memberId);
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto px-5 py-6">
      <h2 className="text-xl font-bold text-text mb-6">Settings</h2>

      <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-3">Organization</h3>
        <div className="text-xs text-text-mid">
          <p><strong>Name:</strong> {currentOrg?.name}</p>
          <p className="mt-1"><strong>Your role:</strong> {role}</p>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-text mb-3">Planning Date Range</h3>
          <p className="text-[10px] text-text-light mb-3">
            Set the minimum and maximum months available for planning. Leave empty for no restriction.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Min Date</label>
              <input
                type="month" value={minDate} onChange={(e) => setMinDate(e.target.value)}
                max={maxDate || undefined}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Max Date</label>
              <input
                type="month" value={maxDate} onChange={(e) => setMaxDate(e.target.value)}
                min={minDate || undefined}
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
              />
            </div>
            <Button onClick={handleSaveDates} disabled={dateSaving}>
              {dateSaving ? 'Saving...' : dateSuccess ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <h3 className="text-sm font-bold text-text mb-4">Members</h3>

        {error && (
          <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
        )}

        {/* Member list */}
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-primary-bg/30">
              <Avatar name={m.user.name} color="#4CBAD4" size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text truncate">{m.user.name}</div>
                <div className="text-[10px] text-text-light truncate">{m.user.email}</div>
              </div>
              {m.role === 'owner' ? (
                <span className="text-[10px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full">Owner</span>
              ) : isAdmin ? (
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  className="text-[10px] px-2 py-1 border border-border rounded-lg bg-white text-text-mid"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] text-text-light capitalize">{m.role}</span>
              )}
              {isAdmin && m.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(m.id, m.user.name)}
                  className="text-[10px] text-danger bg-transparent border-0 cursor-pointer hover:text-danger/80 px-1"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-xs text-text-light py-2">No members yet.</p>
          )}
        </div>

        {/* Add member form */}
        {isAdmin && (
          <form onSubmit={handleAdd} className="flex gap-2 items-end pt-3 border-t border-border-light">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com" required
                className="w-full px-3 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-text-mid mb-1">Role</label>
              <select
                value={newRole} onChange={(e) => setNewRole(e.target.value)}
                className="px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
