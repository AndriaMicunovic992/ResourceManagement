import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const SCOPE_STYLE = {
  none: 'text-text-light',
  own: 'text-text-mid',
  team: 'text-primary',
  all: 'text-success',
};

function Cell({ on }) {
  return on ? (
    <span className="text-success font-bold">✓</span>
  ) : (
    <span className="text-border">·</span>
  );
}

/**
 * Read-only view of the org's roles and their permission matrix. The editable
 * version + custom roles + live enforcement land in the following stages; this
 * shows the seeded system roles so the model is visible.
 */
export default function RolesSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeRole, setActiveRole] = useState(0);

  useEffect(() => {
    let dead = false;
    api.getRoles()
      .then((d) => { if (!dead) setData(d); })
      .catch((e) => { if (!dead) setError(e.message || 'Failed to load roles'); });
    return () => { dead = true; };
  }, []);

  if (error) return <div className="text-xs text-danger bg-danger-bg p-2 rounded">{error}</div>;
  if (!data) return <div className="text-xs text-text-light py-2">Loading roles…</div>;

  const { segments, scopes, roles } = data;
  const scopeLabel = Object.fromEntries(scopes.map((s) => [s.key, s.label]));
  const role = roles[activeRole] || roles[0];

  return (
    <div>
      <p className="text-[11px] text-text-light mb-3">
        What each role can do, by area. Scope controls what they can see (and the reach of their
        edits); the checkmarks are create / edit / delete. Editing and custom roles are coming next.
      </p>

      {/* role switcher */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {roles.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setActiveRole(i)}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
              i === activeRole
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-text-mid border-border-light hover:bg-primary-bg'
            }`}
          >
            {r.name}
            {r.isSystem && <span className="ml-1 opacity-60 font-normal">· system</span>}
          </button>
        ))}
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
              const p = role.permissions[seg.key] || { scope: 'none' };
              return (
                <tr key={seg.key} className="border-t border-border-light">
                  <td className="px-3 py-1.5 font-semibold text-text">{seg.label}</td>
                  <td className={`px-3 py-1.5 font-semibold ${SCOPE_STYLE[p.scope] || ''}`}>
                    {scopeLabel[p.scope] || p.scope}
                  </td>
                  <td className="px-2 py-1.5 text-center"><Cell on={p.create} /></td>
                  <td className="px-2 py-1.5 text-center"><Cell on={p.edit} /></td>
                  <td className="px-2 py-1.5 text-center"><Cell on={p.delete} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
