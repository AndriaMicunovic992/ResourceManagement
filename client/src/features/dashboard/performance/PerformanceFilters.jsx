import { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';

export default function PerformanceFilters({ filters, onChange }) {
  const { teams, domains, seniorities } = useData();

  const roleOptions = useMemo(() => {
    if (!filters.domain) {
      const all = new Set();
      domains.forEach((d) => d.roles.forEach((r) => all.add(r.name)));
      return Array.from(all);
    }
    return domains.find((d) => d.name === filters.domain)?.roles.map((r) => r.name) ?? [];
  }, [filters.domain, domains]);

  const patch = (p) => onChange({ ...filters, ...p });

  return (
    <div className="bg-white rounded-2xl border border-border-light p-3 mb-4">
      <div className="flex items-center flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold text-text-light">From</label>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => patch({ from: e.target.value })}
            className="px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-semibold text-text-light">To</label>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => patch({ to: e.target.value })}
            className="px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
          />
        </div>
        <select
          value={filters.teamId ?? ''}
          onChange={(e) => patch({ teamId: e.target.value })}
          className="px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={filters.domain ?? ''}
          onChange={(e) => patch({ domain: e.target.value, role: '' })}
          className="px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">All domains</option>
          {domains.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
        <select
          value={filters.role ?? ''}
          onChange={(e) => patch({ role: e.target.value })}
          className="px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">All roles</option>
          {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filters.seniority ?? ''}
          onChange={(e) => patch({ seniority: e.target.value })}
          className="px-2.5 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white"
        >
          <option value="">All seniorities</option>
          {seniorities.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        {(filters.from || filters.to || filters.teamId || filters.domain || filters.role || filters.seniority) && (
          <button
            onClick={() => onChange({ from: '', to: '', teamId: '', domain: '', role: '', seniority: '' })}
            className="text-[11px] font-bold text-text-mid bg-white border border-border-light rounded-lg px-2.5 py-1 cursor-pointer hover:bg-primary-bg"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
