import { useMemo } from 'react';
import ResourceFilterRow from './ResourceFilterRow';
import { DOMAINS, SENIORITIES, SENIORITY_SHORT } from '../../../lib/constants';

export default function ResourceFilters({ filters, onChange, teams = [] }) {
  const domainOptions = ['All', ...Object.keys(DOMAINS)];

  const roleOptions = useMemo(() => {
    if (filters.domain === 'All') {
      const all = new Set();
      Object.values(DOMAINS).forEach((d) => d.roles.forEach((r) => all.add(r)));
      return ['All', ...all];
    }
    return ['All', ...DOMAINS[filters.domain].roles];
  }, [filters.domain]);

  const seniorityOptions = ['All', ...Object.values(SENIORITY_SHORT)];
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
