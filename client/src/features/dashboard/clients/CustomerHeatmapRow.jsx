import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HeatmapCell from './HeatmapCell';
import EpicDrillRows from '../EpicDrillRows';
import Avatar from '../../../components/ui/Avatar';
import StatusBadge from '../../../components/ui/StatusBadge';
import { api } from '../../../lib/api';
import { ACCENT_COLORS, hoursToFte, MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS } from '../../../lib/constants';
import { currentMonth, formatMonth } from '../../../lib/dateUtils';
import { availableHours, deliverableRatio, effectiveCapacity } from '../../../lib/availability';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { useVisibility } from '../../../contexts/VisibilityContext';

export default function CustomerHeatmapRow({ customer, index, months, includePotential, teamResourceIds, teamId, actuals }) {
  const [expanded, setExpanded] = useState(false);
  const { projects, needs, assignments, resources } = useData();
  const { rURealised } = useComputed();
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
    const cur = currentMonth();
    const resById = new Map(resources.map((r) => [r.id, r]));
    // What the plan can deliver given each assignee's absences. Absence eats
    // the person's slack first: only when their TOTAL plan exceeds the hours
    // left (synced absences for elapsed months, planned days off ahead) does
    // this client's share shrink, pro-rata.
    const ratioFor = (rid, m) => {
      const r = resById.get(rid);
      const planTotalH = (rURealised[rid]?.[m] || 0) * MONTHLY_HOURS_PER_FTE;
      const availH = m <= cur
        ? availableHours(actuals?.byResourceType?.[rid]?.[m], r?.capacity || 1)
        : effectiveCapacity(r, m) * MONTHLY_HOURS_PER_FTE;
      return deliverableRatio(planTotalH, availH);
    };
    for (const m of months) {
      let totalNeeded = 0, totalFilled = 0, totalExpected = 0;
      let hasPotential = false;
      for (const n of custNeeds) {
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
        const proj = projects.find((p) => p.id === n.projectId);
        if (proj?.status === 'potential') hasPotential = true;
      }
      result[m] = { totalNeeded, totalFilled, totalExpected, isPotential: hasPotential };
    }
    return result;
  }, [custProjects, needs, assignments, resources, rURealised, months, includePotential, projects, teamResourceIds, actuals]);

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
            {/* The plan (needs/projects) is no longer a drill level here —
                jump to it instead; profile mirrors the name click. */}
            <div className="flex items-center gap-2 text-[10px]">
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/planner?customerId=${customer.id}`); }}
                className="text-primary font-semibold bg-transparent border-0 p-0 cursor-pointer hover:underline"
              >
                plan →
              </button>
              {canOpen && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/customers/${customer.id}`); }}
                  className="text-text-light font-semibold bg-transparent border-0 p-0 cursor-pointer hover:underline hover:text-text-mid"
                >
                  profile →
                </button>
              )}
              <span className="text-text-light">· {custProjects.length} project{custProjects.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
        {months.map((m) => {
          const d = staffingByMonth[m];
          const act = custHasActuals && m <= cur ? hoursToFte(custActuals[m] || 0) : null;
          return (
            <HeatmapCell key={m} title={`${customer.name} · ${formatMonth(m)}`}
              plan={d.totalFilled} expected={d.totalExpected} needed={d.totalNeeded} act={act} max={rowMax} accent={accent}
              isPotential={d.isPotential && includePotential} actualPartial={m === cur}
              inHours={!!actuals} />
          );
        })}
      </div>
      {/* The drill follows the logged hours, not the plan: Jira epics →
          tasks → the people who logged them. The plan lives in the planner
          (the "plan →" link above). */}
      {expanded && (custHasActuals ? (
        <EpicDrillRows
          load={() => (actuals?.window?.from && actuals?.window?.to
            ? api.getCustomerEpicActuals(customer.id, actuals.window.from, actuals.window.to, teamId)
            : Promise.resolve([]))}
          loadKey={`${customer.id}:${actuals?.window?.from}:${actuals?.window?.to}:${teamId || ''}`}
          months={months} cur={cur}
          color={WORK_TYPE_COLORS.client} accent={accent}
          tipPrefix={customer.name}
        />
      ) : (
        <div className="flex items-center border-b border-border-light/50 bg-[#F6F9FC] pl-[68px] py-1.5 text-[10px] text-text-light">
          No logged hours for this customer in the window — the plan lives under “plan →”.
        </div>
      ))}
    </>
  );
}
