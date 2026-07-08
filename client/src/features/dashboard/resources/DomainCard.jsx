import { useMemo } from 'react';
import { domainColor } from '../../../lib/taxonomy';
import { utilColor } from '../../../lib/statusUtils';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS } from '../../../lib/constants';
import { currentMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import StackedPlanBar from '../StackedPlanBar';
import InfoDot from '../../../components/ui/InfoDot';

/**
 * One domain's (or, with domain = null, everyone's) capacity summary. The bar
 * reads like the heatmap rows below: soft track with a tick = average planned
 * FTE, stacked fill = the average FTE actually logged per completed month
 * (green client / violet internal / slate absences), both anchored at the
 * group's capacity.
 */
export default function DomainCard({ domain, months, includePotential, teamId, actuals }) {
  const { resources } = useData();
  const { rURealised, rU } = useComputed();

  const { count, utilPct, usedFte, totalFte, actSegments, actPct } = useMemo(() => {
    const scoped = teamId ? resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)) : resources;
    const domResources = domain ? scoped.filter((r) => r.roles?.some((rl) => rl.domain === domain)) : scoped;
    const count = domResources.length;
    const rUsed = includePotential ? rU : rURealised;
    let used = 0, total = 0;
    for (const r of domResources) {
      for (const m of months) {
        total += r.capacity;
        used += rUsed[r.id]?.[m] || 0;
      }
    }
    // Average per month
    const avgUsed = months.length > 0 ? used / months.length : 0;
    const avgTotal = months.length > 0 ? total / months.length : 0;

    // Logged hours by work type, averaged over the COMPLETED months of the
    // window (the in-progress month would drag the average down) — as FTE so
    // the stack shares the bar's scale.
    const cur = currentMonth();
    const typed = { client: 0, internal: 0, absence: 0 };
    let elapsed = 0;
    for (const m of months) {
      if (m >= cur) continue;
      elapsed++;
      for (const r of domResources) {
        const t = actuals?.byResourceType?.[r.id]?.[m];
        if (!t) continue;
        typed.client += t.client || 0;
        typed.internal += t.internal || 0;
        typed.absence += t.absence || 0;
      }
    }
    const toAvgFte = (h) => (elapsed > 0 ? h / elapsed / MONTHLY_HOURS_PER_FTE : 0);
    const workedAvgFte = toAvgFte(typed.client + typed.internal);
    const hasAct = typed.client + typed.internal + typed.absence > 0.05;
    return {
      count,
      utilPct: avgTotal > 0 ? Math.round((avgUsed / avgTotal) * 100) : 0,
      usedFte: avgUsed,
      totalFte: avgTotal,
      actSegments: hasAct
        ? [
            { value: toAvgFte(typed.client), color: WORK_TYPE_COLORS.client },
            { value: toAvgFte(typed.internal), color: WORK_TYPE_COLORS.internal },
            { value: toAvgFte(typed.absence), color: WORK_TYPE_COLORS.absence },
          ]
        : [],
      actPct: hasAct && avgTotal > 0 ? Math.round((workedAvgFte / avgTotal) * 100) : null,
    };
  }, [resources, rURealised, rU, domain, months, includePotential, teamId, actuals]);

  const color = utilColor(utilPct);
  const accent = domain ? domainColor(domain) : '#4CBAD4';
  const label = includePotential ? 'all' : 'realised';

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: accent }} />
          <span className="text-[13px] font-bold text-text">{domain || 'Everyone'}</span>
          <InfoDot text={`${domain ? 'Average utilization of this domain’s people' : 'Average utilization of everyone in scope'} over the selected months: mean used FTE ÷ mean capacity per month. “Used” is realised allocation, or all planned with Include potential on. The bar reads like the heatmap below — soft track with a tick = the plan, stacked fill = logged hours by type (green client, violet internal, slate absences), averaged over completed months. The number on the right is the headcount.`} />
        </div>
        <span className="text-xs font-mono text-text-mid">{count}</span>
      </div>
      <StackedPlanBar plan={usedFte} segments={actSegments} max={totalFte} accent={accent} className="mb-1.5" />
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-text-light">{usedFte.toFixed(1)} / {totalFte.toFixed(1)} FTE ({label})</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>
          {utilPct}%
          {actPct != null && <span className="text-[9px] font-semibold text-text-light"> · act {actPct}%</span>}
        </span>
      </div>
    </div>
  );
}
