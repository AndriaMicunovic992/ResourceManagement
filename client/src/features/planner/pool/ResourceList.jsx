import { useMemo } from 'react';
import ResourceCard from './ResourceCard';
import { SENIORITY_SHORT } from '../../../lib/constants';

export default function ResourceList({ resources, filters, heldResource, onHold, onEdit, onDelete, timeRange, canEdit }) {
  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (filters.domain !== 'All' && !r.roles?.some((rl) => rl.domain === filters.domain)) return false;
      if (filters.role !== 'All' && !r.roles?.some((rl) => rl.role === filters.role)) return false;
      if (filters.seniority !== 'All') {
        const senFull = Object.entries(SENIORITY_SHORT).find(([, v]) => v === filters.seniority)?.[0];
        if (senFull && !r.roles?.some((rl) => rl.seniority === senFull)) return false;
      }
      return true;
    });
  }, [resources, filters]);

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
