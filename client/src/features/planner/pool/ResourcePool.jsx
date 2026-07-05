import { useState } from 'react';
import HeldResourceBanner from './HeldResourceBanner';
import ResourceFilters from './ResourceFilters';
import ResourceList from './ResourceList';
import { useData } from '../../../contexts/DataContext';

export default function ResourcePool({ heldResource, onHold, timeRange }) {
  const { resources, teams } = useData();
  const [filters, setFilters] = useState({ domain: 'All', role: 'All', seniority: 'All', team: 'All' });
  // Archived (offboarded) people aren't staffable — keep them out of the pool.
  const activeResources = resources.filter((r) => !r.archived);

  return (
    <div className="w-[260px] bg-white border-r border-border flex flex-col shrink-0">
      {heldResource && (
        <HeldResourceBanner resource={heldResource} onDeselect={() => onHold(null)} />
      )}
      <ResourceFilters filters={filters} onChange={setFilters} teams={teams} />
      <ResourceList
        resources={activeResources} filters={filters}
        heldResource={heldResource} onHold={onHold}
        timeRange={timeRange}
      />
    </div>
  );
}
