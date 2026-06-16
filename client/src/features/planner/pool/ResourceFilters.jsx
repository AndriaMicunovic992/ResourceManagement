import { useMemo } from 'react';
import ResourceFilterRow from './ResourceFilterRow';
import { useData } from '../../../contexts/DataContext';

export default function ResourceFilters({ filters, onChange, teams = [] }) {
  const { domains, seniorities } = useData();
  const domainOptions = ['All', ...domains.map((d) => d.name)];

  const roleOptions = useMemo(() => {
    if (filters.domain === 'All') {
      const all = new Set();
      domains.forEach((d) => d.roles.forEach((r) => all.add(r.name)));
      return ['All', ...all];
    }
    return ['All', ...(domains.find((d) => d.name === filters.domain)?.roles.map((r) => r.name) || [])];
  }, [filters.domain, domains]);

  const seniorityOptions = ['All', ...seniorities.map((s) => s.shortLabel)];
  const teamOptions = ['All', ...teams.map((t) => t.name)];

  return (
    <div className="px-3 pt-1 pb-3 border-b border-border-light">
      <ResourceFilterRow label="Domain" options={domainOptions} value={filters.domain}
        onChange={(v) => onChange({ ...filters, domain: v, role: 'All' })} />
      <ResourceFilterRow label="Role" options={roleOptions} value={filters.role}
        onChange={(v) => onChange({ ...filters, role: v })} />
      <ResourceFilterRow label="Seniority" options={seniorityOptions} value={filters.seniority}
        onChange={(v) => onChange({ ...filters, seniority: v })} />
      {teams.length > 0 && (
        <ResourceFilterRow label="Team" options={teamOptions} value={filters.team || 'All'}
          onChange={(v) => onChange({ ...filters, team: v })} />
      )}
    </div>
  );
}
