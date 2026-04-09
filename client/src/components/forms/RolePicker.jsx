import { DOMAINS, SENIORITIES } from '../../lib/constants';

export default function RolePicker({ roles, onChange }) {
  const domains = Object.keys(DOMAINS);

  const updateRole = (index, field, value) => {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'domain') {
      updated[index].role = DOMAINS[value].roles[0];
    }
    onChange(updated);
  };

  const addRole = () => {
    onChange([...roles, { domain: 'Web', role: 'FE', seniority: 'Medior' }]);
  };

  const removeRole = (index) => {
    if (roles.length <= 1) return;
    onChange(roles.filter((_, i) => i !== index));
  };

  return (
    <div>
      {roles.map((r, i) => (
        <div key={i} className="flex gap-2 mb-2 items-center">
          <select value={r.domain} onChange={(e) => updateRole(i, 'domain', e.target.value)}
            className="px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white">
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={r.role} onChange={(e) => updateRole(i, 'role', e.target.value)}
            className="px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white">
            {DOMAINS[r.domain].roles.map((rl) => <option key={rl} value={rl}>{rl}</option>)}
          </select>
          <select value={r.seniority} onChange={(e) => updateRole(i, 'seniority', e.target.value)}
            className="px-2 py-1.5 border border-border rounded-lg text-xs text-text bg-white">
            {SENIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {roles.length > 1 && (
            <button type="button" onClick={() => removeRole(i)}
              className="text-danger text-sm cursor-pointer border-0 bg-transparent hover:opacity-70">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRole}
        className="text-primary text-xs font-semibold cursor-pointer border border-dashed border-primary rounded-lg px-3 py-1 bg-transparent hover:bg-primary-light mt-1">
        + Add Role
      </button>
    </div>
  );
}
