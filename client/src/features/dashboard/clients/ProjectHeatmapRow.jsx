import HeatmapCell from './HeatmapCell';
import AssignedTeamChips from './AssignedTeamChips';
import StatusBadge from '../../../components/ui/StatusBadge';
import { isProjectOk } from '../../../lib/gridUtils';
import { formatMonth, monthRange, currentMonth } from '../../../lib/dateUtils';
import { hoursToFte } from '../../../lib/constants';
import { availabilityRatio, plannedAvailabilityRatio } from '../../../lib/availability';
import { useData } from '../../../contexts/DataContext';
import { useMemo } from 'react';

export default function ProjectHeatmapRow({ project, customer, months, includePotential, teamResourceIds, actuals, accent }) {
  const { needs, assignments, members, resources } = useData();
  const ok = useMemo(() => isProjectOk(project, needs, assignments), [project, needs, assignments]);
  const isPotentialProject = customer.status === 'potential' || project.status === 'potential';
  const responsibleMember = project.responsibleUserId ? members.find((m) => m.user?.id === project.responsibleUserId) : null;
  const responsible = responsibleMember ? { name: responsibleMember.user?.name || responsibleMember.user?.email } : null;
  const projMonths = useMemo(() => monthRange(project.startMonth, project.endMonth), [project]);

  const staffingByMonth = useMemo(() => {
    const result = {};
    const projNeeds = needs.filter((n) => {
      if (n.projectId !== project.id) return false;
      if (!includePotential && n.status !== 'realised') return false;
      return true;
    });
    const cur = currentMonth();
    const resById = new Map(resources.map((r) => [r.id, r]));
    // Absence-adjusted deliverable plan, like the customer row: synced
    // absences for elapsed months, planned days off for months ahead.
    const ratioFor = (rid, m) => {
      const r = resById.get(rid);
      return m <= cur
        ? availabilityRatio(actuals?.byResourceType?.[rid]?.[m], r?.capacity || 1)
        : plannedAvailabilityRatio(r, m);
    };
    for (const m of months) {
      if (!projMonths.includes(m)) { result[m] = { totalNeeded: 0, totalFilled: 0, totalExpected: 0, isPotential: false }; continue; }
      let totalNeeded = 0, totalFilled = 0, totalExpected = 0;
      let hasPotential = isPotentialProject;
      for (const n of projNeeds) {
        const needed = (n.monthAllocations || {})[m] || 0;
        if (needed <= 0) continue;
        for (const a of assignments) {
          if (a.needId !== n.id) continue;
          if (teamResourceIds && !teamResourceIds.has(a.resourceId)) continue;
          const fte = (a.monthAllocations || {})[m] || 0;
          totalFilled += fte;
          totalExpected += fte * ratioFor(a.resourceId, m);
        }
        totalNeeded += needed;
        if (n.status === 'potential') hasPotential = true;
      }
      result[m] = { totalNeeded, totalFilled, totalExpected, isPotential: hasPotential };
    }
    return result;
  }, [project, needs, assignments, resources, months, projMonths, isPotentialProject, includePotential, teamResourceIds, actuals]);

  // Hours mapped to this specific project (epic → project mappings). A project
  // with no mapped hours in the window gets no actual layer — its work may
  // still be counted at the customer level. Off-window actuals still render:
  // hours logged outside the project's planned months are exactly the kind of
  // drift this view is for.
  const cur = currentMonth();
  const projActuals = actuals?.byProject?.[project.id];
  const projHasActuals = !!projActuals && Object.values(projActuals).some((h) => h > 0);

  // Floored at 1 FTE like the customer rows, so tiny values stay tiny.
  const rowMax = useMemo(() => {
    let max = 0;
    for (const m of months) {
      max = Math.max(max, staffingByMonth[m].totalFilled, staffingByMonth[m].totalNeeded);
      if (projHasActuals && m <= cur) max = Math.max(max, hoursToFte(projActuals[m] || 0));
    }
    return Math.max(max, 1);
  }, [months, staffingByMonth, projHasActuals, projActuals, cur]);

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
          {formatMonth(project.startMonth)}{'→'}{formatMonth(project.endMonth)}
        </div>
        <AssignedTeamChips projectId={project.id} />
      </div>
      {months.map((m) => {
        const d = staffingByMonth[m];
        const act = projHasActuals && m <= cur ? hoursToFte(projActuals[m] || 0) : null;
        return (
          <HeatmapCell key={m} title={`${project.name} · ${formatMonth(m)}`}
            plan={d.totalFilled} expected={d.totalExpected} needed={d.totalNeeded} act={act} max={rowMax} accent={accent}
            isPotential={d.isPotential && includePotential} actualPartial={m === cur} />
        );
      })}
    </div>
  );
}
