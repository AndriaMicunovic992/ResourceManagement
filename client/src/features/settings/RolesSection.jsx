import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Button from '../../components/ui/Button';

const LOCKED = new Set(['owner', 'admin']);

/**
 * Roles & permissions: edit the matrix for member/viewer/custom roles, create
 * and delete custom roles. Owner & admin are full-access and locked. Scope
 * controls visibility; create/edit/delete govern mutations.
 */
export default function RolesSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null); // editable copy of the active role
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBase, setNewBase] = useState('member');

  const load = (selectId) =>
    api.getRoles()
      .then((d) => {
        setData(d);
        setActiveId((prev) => selectId || prev || d.roles[0]?.id);
      })
      .catch((e) => setError(e.message || 'Failed to load roles'));

  useEffect(() => { load(); }, []);

  const active = useMemo(
    () => data?.roles.find((r) => r.id === activeId) || data?.roles[0],
    [data, activeId]
  );

  // Sync the editable draft when the selected role changes.
  useEffect(() => {
    if (active) setDraft({ name: active.name, permissions: structuredClone(active.permissions) });
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="text-xs text-danger bg-danger-bg p-2 rounded">{error}</div>;
  if (!data || !active || !draft) return <div className="text-xs text-text-light py-2">Loading roles…</div>;

  const { segments, scopes } = data;
  const locked = LOCKED.has(active.key);
  const editable = !locked;
  const dirty =
    editable &&
    (draft.name !== active.name ||
      JSON.stringify(draft.permissions) !== JSON.stringify(active.permissions));

  const setSeg = (seg, patch) =>
    setDraft((d) => ({
      ...d,
      permissions: { ...d.permissions, [seg]: { ...d.permissions[seg], ...patch } },
    }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.updateRole(active.id, {
        ...(active.isSystem ? {} : { name: draft.name.trim() }),
        permissions: draft.permissions,
      });
      await load(active.id);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e.message || 'Failed to save');
    }
    setBusy(false);
  };

  const createRole = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await api.createRole({ name: newName.trim(), baseKey: newBase });
      setCreating(false);
      setNewName('');
      await load(created.id);
    } catch (e) {
      setError(e.message || 'Failed to create role');
    }
    setBusy(false);
  };

  const removeRole = async () => {
    if (!window.confirm(`Delete the "${active.name}" role?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteRole(active.id);
      setActiveId(null);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete role');
    }
    setBusy(false);
  };

  return (
    <div>
      <p className="text-[11px] text-text-light mb-3">
        What each role can do, by area. <b>Scope</b> controls what they can see (and the reach of their
        edits); the toggles govern create / edit / delete. Owner &amp; admin always have full access.
      </p>

      {/* role switcher + create */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {data.roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveId(r.id)}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
              r.id === active.id
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-mid border-border-light hover:bg-primary-bg'
            }`}
          >
            {r.name}
            {!r.isSystem && <span className="ml-1 opacity-60 font-normal">· custom</span>}
          </button>
        ))}
        <button
          onClick={() => setCreating((v) => !v)}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-dashed border-border-dark text-text-mid hover:bg-primary-bg"
        >
          ＋ New role
        </button>
      </div>

      {creating && (
        <div className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-primary-bg/50 rounded-xl border border-border-light">
          <label className="text-[11px] font-semibold text-text-mid">
            Name
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Team lead"
              autoFocus
              className="block mt-1 px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white min-w-[160px]"
            />
          </label>
          <label className="text-[11px] font-semibold text-text-mid">
            Start from
            <select
              value={newBase}
              onChange={(e) => setNewBase(e.target.value)}
              className="block mt-1 px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <Button onClick={createRole} disabled={busy || !newName.trim()}>Create</Button>
          <button onClick={() => setCreating(false)} className="text-[11px] text-text-mid px-2 py-1.5">Cancel</button>
        </div>
      )}

      {/* header row: name + actions */}
      <div className="flex items-center gap-2 mb-2">
        {active.isSystem ? (
          <span className="text-sm font-bold text-text">{active.name}</span>
        ) : (
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="text-sm font-bold text-text border border-border-light rounded-lg px-2 py-1 outline-none focus:border-primary"
          />
        )}
        {locked && <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-light bg-[#EEF1F5] rounded-full px-2 py-0.5">Full access · locked</span>}
        <span className="flex-1" />
        {savedAt > 0 && !dirty && !busy && <span className="text-[10px] text-success font-semibold">Saved ✓</span>}
        {!active.isSystem && (
          <button onClick={removeRole} disabled={busy} className="text-[11px] font-bold text-danger bg-danger-bg border-0 rounded-lg px-3 py-1.5 cursor-pointer hover:brightness-95">
            Delete
          </button>
        )}
        {editable && (
          <Button onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save'}</Button>
        )}
      </div>

      <div className="overflow-x-auto border border-border-light rounded-xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#F7FAFC] text-[9.5px] uppercase tracking-wider text-text-light">
              <th className="text-left font-bold px-3 py-2">Area</th>
              <th className="text-left font-bold px-3 py-2">Scope</th>
              <th className="text-center font-bold px-2 py-2">Create</th>
              <th className="text-center font-bold px-2 py-2">Edit</th>
              <th className="text-center font-bold px-2 py-2">Delete</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => {
              const p = draft.permissions[seg.key] || { scope: 'none' };
              const disabled = !editable || p.scope === 'none';
              return (
                <tr key={seg.key} className="border-t border-border-light">
                  <td className="px-3 py-1.5 font-semibold text-text">{seg.label}</td>
                  <td className="px-3 py-1.5">
                    <select
                      value={p.scope}
                      disabled={!editable}
                      onChange={(e) => setSeg(seg.key, { scope: e.target.value })}
                      className="text-[11px] font-semibold border border-border-light rounded-md px-1.5 py-1 outline-none focus:border-primary bg-white disabled:bg-transparent disabled:border-transparent"
                    >
                      {scopes.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  {['create', 'edit', 'delete'].map((act) => (
                    <td key={act} className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={!!p[act] && p.scope !== 'none'}
                        disabled={disabled}
                        onChange={(e) => setSeg(seg.key, { [act]: e.target.checked })}
                        className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-40"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-text-light mt-2">
        Note: per-area <b>scope</b> on reads is rolling out; create / edit / delete are enforced now.
      </p>
    </div>
  );
}
