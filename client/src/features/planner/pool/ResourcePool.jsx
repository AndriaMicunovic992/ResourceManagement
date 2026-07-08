import { useState } from 'react';
import HeldResourceBanner from './HeldResourceBanner';
import ResourceFilters from './ResourceFilters';
import ResourceList from './ResourceList';
import AbsencePopover from './AbsencePopover';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';

export default function ResourcePool({ heldResource, onHold, timeRange, onError }) {
  const { resources, teams } = useData();
  const { canEdit } = useOrg();
  const [filters, setFilters] = useState({ domain: 'All', role: 'All', seniority: 'All', team: 'All' });
  // { resourceId, x, y } — the planned-days-off editor for one person.
  const [absenceFor, setAbsenceFor] = useState(null);
  // Archived (offboarded) people aren't staffable — keep them out of the pool.
  const activeResources = resources.filter((r) => !r.archived);
  // Re-resolve from the live collection so the popover shows fresh values
  // right after a save (the captured row would be stale).
  const absenceResource = absenceFor ? resources.find((r) => r.id === absenceFor.resourceId) : null;

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
        onAbsence={canEdit ? (resource, pos) => setAbsenceFor({ resourceId: resource.id, ...pos }) : undefined}
      />
      {absenceResource && (
        <AbsencePopover
          resource={absenceResource}
          timeRange={timeRange}
          x={absenceFor.x} y={absenceFor.y}
          onClose={() => setAbsenceFor(null)}
          onError={onError}
        />
      )}
    </div>
  );
}
