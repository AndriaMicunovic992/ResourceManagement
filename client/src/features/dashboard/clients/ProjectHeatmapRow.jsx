import HeatmapCell from './HeatmapCell';
import AssignedTeamChips from './AssignedTeamChips';
import StatusBadge from '../../../components/ui/StatusBadge';
import { isProjectOk } from '../../../lib/gridUtils';
import { formatMonth, monthRange } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useMemo } from 'react';

export default function ProjectHeatmapRow({ project, customer, months, includePotential }) {
  const { needs, assignments, resources } = useData();
  const ok = useMemo(() => isProjectOk(project, needs, assignments), [project, needs, assignments]);
  const isPotentialProject = customer.status === 'potential' || project.status === 'potential';
  const responsible = project.responsiblePersonId ? resources.find((r) => r.id === project.responsiblePersonId) : null;
  const projMonths = useMemo(() => monthRange(project.startMonth, project.endMonth), [project]);

  const staffingByMonth = useMemo(() => {
    const result = {};
    const projNeeds = needs.filter((n) => {
      if (n.projectId !== project.id) return false;
      if (!includePotential && n.status !== 'realised') return false;
      return true;
    });
    for (const m of months) {
      if (!projMonths.includes(m)) { result[m] = { ratio: null, totalNeeded: 0, totalFilled: 0, isPotential: false }; continue; }
      let totalNeeded = 0, totalFilled = 0;
      let hasPotential = isPotentialProject;
      for (const n of projNeeds) {
        const needed = (n.monthAllocations || {})[m] || 0;
        if (needed <= 0) continue;
        const filled = assignments.filter((a) => a.needId === n.id).reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        totalNeeded += needed;
        totalFilled += filled;
        if (n.status === 'potential') hasPotential = true;
      }
      result[m] = {
        ratio: totalNeeded > 0 ? totalFilled / totalNeeded : null,
        totalNeeded,
        totalFilled,
        isPotential: hasPotential,
      };
    }
    return result;
  }, [project, needs, assignments, months, projMonths, isPotentialProject, includePotential]);

  return (
    <div className="flex items-center border-b border-border-light" style={{ opacity: isPotentialProject ? 0.75 : 1 }}>
      <div className="w-[270px] shrink-0 pl-9 py-2 pr-3">
        <div className="flex items-center gap-1">
          {ok && <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />}
          <span className="text-xs font-bold text-text-mid truncate">{project.name}</span>
          {responsible && <span className="text-[9px] text-text-light ml-1">({responsible.name})</span>}
          <StatusBadge status={project.status} small />
        </div>
        <div className="text-[9px] font-mono text-text-light mt-0.5">
          {formatMonth(project.startMonth)}{'\u2192'}{formatMonth(project.endMonth)}
        </div>
        <AssignedTeamChips projectId={project.id} />
      </div>
      {months.map((m) => {
        const d = staffingByMonth[m];
        return (
          <HeatmapCell key={m} value={d.ratio} totalNeeded={d.totalNeeded} totalFilled={d.totalFilled}
            isPotential={d.isPotential && includePotential} showDash={!projMonths.includes(m)} />
        );
      })}
    </div>
  );
}
