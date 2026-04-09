import { domainColor, initials, firstName } from '../../../lib/resourceUtils';
import { useData } from '../../../contexts/DataContext';

export default function AssignedTeamChips({ projectId }) {
  const { needs, assignments, resources } = useData();
  const projNeeds = needs.filter((n) => n.projectId === projectId);
  const resourceIds = new Set();
  for (const n of projNeeds) {
    for (const a of assignments.filter((a) => a.needId === n.id)) {
      resourceIds.add(a.resourceId);
    }
  }

  const assignedResources = resources.filter((r) => resourceIds.has(r.id));

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {assignedResources.map((r) => {
        const color = domainColor(r.roles?.[0]?.domain || 'Web');
        return (
          <span key={r.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold"
            style={{ backgroundColor: color + '15', color }}>
            <span className="font-bold">{initials(r.name).charAt(0)}</span>
            {firstName(r.name)}
          </span>
        );
      })}
    </div>
  );
}
