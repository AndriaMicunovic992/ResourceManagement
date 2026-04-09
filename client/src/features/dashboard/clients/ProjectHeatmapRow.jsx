import HeatmapCell from './HeatmapCell';
import AssignedTeamChips from './AssignedTeamChips';
import StatusBadge from '../../../components/ui/StatusBadge';
import { isProjectOk } from '../../../lib/gridUtils';
import { formatMonth, monthRange } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useMemo } from 'react';

export default function ProjectHeatmapRow({ project, customer, months }) {
  const { needs, assignments } = useData();
  const ok = useMemo(() => isProjectOk(project, needs, assignments), [project, needs, assignments]);
  const isPotential = customer.status === 'potential' || project.status === 'potential';
  const projMonths = useMemo(() => monthRange(project.startMonth, project.endMonth), [project]);

  const staffingByMonth = useMemo(() => {
    const result = {};
    const projNeeds = needs.filter((n) => n.projectId === project.id);
    for (const m of months) {
      if (!projMonths.includes(m)) { result[m] = null; continue; }
      let totalNeeded = 0, totalFilled = 0;
      for (const n of projNeeds) {
        const needed = (n.monthAllocations || {})[m] || 0;
        const filled = assignments.filter((a) => a.needId === n.id).reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        totalNeeded += needed;
        totalFilled += filled;
      }
      result[m] = totalNeeded > 0 ? totalFilled / totalNeeded : null;
    }
    return result;
  }, [project, needs, assignments, months, projMonths]);

  return (
    <div className="flex items-center border-b border-border-light" style={{ opacity: isPotential ? 0.65 : 1 }}>
      <div className="w-[270px] shrink-0 pl-9 py-2 pr-3">
        <div className="flex items-center gap-1">
          {ok && <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />}
          <span className="text-xs font-bold text-text-mid truncate">{project.name}</span>
          <StatusBadge status={project.status} small />
        </div>
        <div className="text-[9px] font-mono text-text-light mt-0.5">
          {formatMonth(project.startMonth)}→{formatMonth(project.endMonth)}
        </div>
        <AssignedTeamChips projectId={project.id} />
      </div>
      {months.map((m) => (
        <HeatmapCell key={m} value={staffingByMonth[m]} showDash={!projMonths.includes(m)} />
      ))}
    </div>
  );
}
