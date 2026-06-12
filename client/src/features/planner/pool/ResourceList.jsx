import { useMemo } from 'react';
import ResourceCard from './ResourceCard';
import { SENIORITY_SHORT } from '../../../lib/constants';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { useData } from '../../../contexts/DataContext';

export default function ResourceList({ resources, filters, heldResource, onHold, timeRange }) {
  const { teams } = useData();
  const filtered = useMemo(() => {
    const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));
    return resources.filter((r) => {
      if (filters.domain !== 'All' && !r.roles?.some((rl) => rl.domain === filters.domain)) return false;
      if (filters.role !== 'All' && !r.roles?.some((rl) => rl.role === filters.role)) return false;
      if (filters.seniority !== 'All') {
        const senFull = Object.entries(SENIORITY_SHORT).find(([, v]) => v === filters.seniority)?.[0];
        if (senFull && !r.roles?.some((rl) => rl.seniority === senFull)) return false;
      }
      if (filters.team && filters.team !== 'All') {
        const wantId = teamIdByName.get(filters.team);
        if (!wantId) return false;
        if (!(r.teams || []).some((t) => t.id === wantId)) return false;
      }
      return true;
    });
  }, [resources, filters, teams]);

  // Group by primary domain with count chips (Data / Web / General order).
  const groups = useMemo(() => {
    const order = { Data: 0, Web: 1, General: 2 };
    const map = new Map();
    for (const r of filtered) {
      const d = resourcePrimaryDomain(r) || 'General';
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(r);
    }
    return [...map.entries()].sort((a, b) => (order[a[0]] ?? 9) - (order[b[0]] ?? 9));
  }, [filtered]);

  if (filtered.length === 0) {
    return <div className="text-center text-text-light text-xs py-8">No matches</div>;
  }

  return (
    <div className="p-2 overflow-y-auto flex-1">
      {groups.map(([domain, people]) => (
        <div key={domain} className="mb-2">
          <div className="flex items-center gap-1.5 px-2 pt-1 pb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: domainColor(domain) }} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-mid">{domain}</span>
            <span className="text-[9px] font-mono font-bold text-text-light bg-border-light rounded-full px-1.5">
              {people.length}
            </span>
          </div>
          {people.map((r) => (
            <ResourceCard
              key={r.id} resource={r}
              selected={heldResource?.id === r.id}
              onSelect={(res) => onHold(heldResource?.id === res.id ? null : res)}
              timeRange={timeRange}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
