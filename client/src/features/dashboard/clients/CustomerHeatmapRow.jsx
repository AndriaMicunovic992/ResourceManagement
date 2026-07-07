import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HeatmapCell from './HeatmapCell';
import ProjectHeatmapRow from './ProjectHeatmapRow';
import Avatar from '../../../components/ui/Avatar';
import StatusBadge from '../../../components/ui/StatusBadge';
import { ACCENT_COLORS, hoursToFte } from '../../../lib/constants';
import { currentMonth, formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useVisibility } from '../../../contexts/VisibilityContext';

export default function CustomerHeatmapRow({ customer, index, months, includePotential, teamResourceIds, actuals }) {
  const [expanded, setExpanded] = useState(false);
  const { projects, needs, assignments } = useData();
  const { canViewCustomer } = useVisibility();
  const navigate = useNavigate();
  const canOpen = canViewCustomer(customer.id);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const custProjects = useMemo(() => {
    const all = projects.filter((p) => p.customerId === customer.id);
    if (includePotential) return all;
    return all.filter((p) => p.status === 'realised');
  }, [projects, customer.id, includePotential]);

  const staffingByMonth = useMemo(() => {
    const result = {};
    const custNeeds = needs.filter((n) => {
      if (!custProjects.some((p) => p.id === n.projectId)) return false;
      if (!includePotential && n.status !== 'realised') return false;
      return true;
    });
    for (const m of months) {
      let totalNeeded = 0, totalFilled = 0;
      let hasPotential = false;
      for (const n of custNeeds) {
        const needed = (n.monthAllocations || {})[m] || 0;
        if (needed <= 0) continue;
        const filled = assignments
          .filter((a) => a.needId === n.id && (!teamResourceIds || teamResourceIds.has(a.resourceId)))
          .reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        totalNeeded += needed;
        totalFilled += filled;
        if (n.status === 'potential') hasPotential = true;
        const proj = projects.find((p) => p.id === n.projectId);
        if (proj?.status === 'potential') hasPotential = true;
      }
      result[m] = { totalNeeded, totalFilled, isPotential: hasPotential };
    }
    return result;
  }, [custProjects, needs, assignments, months, includePotential, projects, teamResourceIds]);

  // Actual FTE logged on this customer per elapsed month. Customers with no
  // synced hours anywhere in the window get no actual layer at all (they're
  // likely just not mapped), rather than a misleading wall of zeros.
  const cur = currentMonth();
  const custActuals = actuals?.byCustomer?.[customer.id];
  const custHasActuals = !!custActuals && Object.values(custActuals).some((h) => h > 0);

  // Row scale: bullet lengths are fractions of the row's own peak, so bars
  // compare within the row; absolute values live in the labels. Floored at
  // 1 FTE so a row with only tiny values (e.g. 0.2 of unplanned work) doesn't
  // blow them up to full-width bars.
  const rowMax = useMemo(() => {
    let max = 0;
    for (const m of months) {
      max = Math.max(max, staffingByMonth[m].totalFilled, staffingByMonth[m].totalNeeded);
      if (custHasActuals && m <= cur) max = Math.max(max, hoursToFte(custActuals[m] || 0));
    }
    return Math.max(max, 1);
  }, [months, staffingByMonth, custHasActuals, custActuals, cur]);

  return (
    <>
      <div className="flex items-center border-b border-border cursor-pointer hover:bg-primary-bg/30"
        style={{ background: customer.status === 'potential' ? '#F9FAFB' : accent + '08' }}
        onClick={() => setExpanded(!expanded)}>
        <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] text-text-mid transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          <Avatar name={customer.name} color={customer.status === 'potential' ? '#9CA3AF' : accent} size={28} className="rounded-lg text-[11px]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {canOpen ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/customers/${customer.id}`);
                  }}
                  className="text-[13px] font-bold text-text truncate bg-transparent border-0 p-0 cursor-pointer hover:text-primary hover:underline text-left"
                >
                  {customer.name}
                </button>
              ) : (
                <span className="text-[13px] font-bold text-text truncate">{customer.name}</span>
              )}
              <StatusBadge status={customer.status} />
            </div>
            <div className="text-[10px] text-text-light">{custProjects.length} projects</div>
          </div>
        </div>
        {months.map((m) => {
          const d = staffingByMonth[m];
          const act = custHasActuals && m <= cur ? hoursToFte(custActuals[m] || 0) : null;
          return (
            <HeatmapCell key={m} title={`${customer.name} · ${formatMonth(m)}`}
              plan={d.totalFilled} needed={d.totalNeeded} act={act} max={rowMax} accent={accent}
              isPotential={d.isPotential && includePotential} actualPartial={m === cur} />
          );
        })}
      </div>
      {expanded && custProjects.map((p) => (
        <ProjectHeatmapRow key={p.id} project={p} customer={customer} months={months} includePotential={includePotential}
          teamResourceIds={teamResourceIds} actuals={actuals} accent={accent} />
      ))}
    </>
  );
}
