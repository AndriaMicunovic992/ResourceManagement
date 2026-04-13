import { useMemo } from 'react';
import ResourceCard from './ResourceCard';
import { SENIORITY_SHORT } from '../../../lib/constants';
import { useData } from '../../../contexts/DataContext';

export default function ResourceList({ resources, filters, heldResource, onHold, onEdit, onDelete, timeRange, canEdit }) {
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
        if (r.teamId !== wantId) return false;
      }
      return true;
    });
  }, [resources, filters, teams]);

  if (filtered.length === 0) {
    return <div className="text-center text-text-light text-xs py-8">No matches</div>;
  }

  return (
    <div className="p-3 overflow-y-auto flex-1">
      {filtered.map((r) => (
        <ResourceCard
          key={r.id} resource={r}
          selected={heldResource?.id === r.id}
          onSelect={(res) => onHold(heldResource?.id === res.id ? null : res)}
          onEdit={() => onEdit(r)}
          onDelete={() => onDelete(r.id)}
          timeRange={timeRange}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
