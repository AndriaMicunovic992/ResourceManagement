import { useState } from 'react';
import ResourcePoolHeader from './ResourcePoolHeader';
import HeldResourceBanner from './HeldResourceBanner';
import ResourceFilters from './ResourceFilters';
import ResourceList from './ResourceList';
import { useData } from '../../../contexts/DataContext';

export default function ResourcePool({ heldResource, onHold, timeRange }) {
  const { resources, teams } = useData();
  const [filters, setFilters] = useState({ domain: 'All', role: 'All', seniority: 'All', team: 'All' });

  return (
    <div className="w-[260px] bg-white border-r border-border flex flex-col shrink-0">
      <ResourcePoolHeader />
      {heldResource && (
        <HeldResourceBanner resource={heldResource} onDeselect={() => onHold(null)} />
      )}
      <ResourceFilters filters={filters} onChange={setFilters} teams={teams} />
      <ResourceList
        resources={resources} filters={filters}
        heldResource={heldResource} onHold={onHold}
        timeRange={timeRange}
      />
    </div>
  );
}
