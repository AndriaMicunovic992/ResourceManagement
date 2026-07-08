import { useMemo } from 'react';
import ResourceHeatmapRow from './ResourceHeatmapRow';
import { formatMonth, currentMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { utilColor } from '../../../lib/statusUtils';
import { MONTHLY_HOURS_PER_FTE } from '../../../lib/constants';
import { hoursForFilter, typesForFilter } from '../workTypeLens';
import InfoDot from '../../../components/ui/InfoDot';
import ActualsLegend from '../ActualsLegend';

export default function ResourceHeatmap({ months, onResourceClick, includePotential, teamId, actuals, workTypeFilter = 'work' }) {
  const { resources } = useData();
  const { rURealised, rU } = useComputed();

  const visibleResources = useMemo(
    () => (teamId ? resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)) : resources),
    [resources, teamId]
  );

  const cur = currentMonth();
  const showActuals = !!actuals?.hasActuals;

  // Totals: average utilization per month across visible resources
  const totals = useMemo(() => {
    const result = {};
    const rUsed = includePotential ? rU : rURealised;
    for (const m of months) {
      let totalUsed = 0, totalCap = 0;
      for (const r of visibleResources) {
        totalCap += r.capacity;
        totalUsed += rUsed[r.id]?.[m] || 0;
      }
      result[m] = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0;
    }
    return result;
  }, [visibleResources, months, rURealised, rU, includePotential]);

  // Actual utilization per elapsed month under the work-type lens — matched
  // people (linked to a Jira account) over matched capacity only, so untracked
  // people don't dilute it. Same convention as the home dashboard.
  const actualTotals = useMemo(() => {
    if (!showActuals) return {};
    const byType = actuals?.byResourceType || {};
    const matched = visibleResources.filter((r) => r.externalWorkId);
    const matchedCap = matched.reduce((s, r) => s + (r.capacity || 1), 0);
    if (matchedCap <= 0) return {};
    const result = {};
    for (const m of months) {
      if (m > cur) continue;
      let hours = 0;
      for (const r of matched) hours += hoursForFilter(byType[r.id]?.[m], workTypeFilter);
      result[m] = Math.round(((hours / MONTHLY_HOURS_PER_FTE) / matchedCap) * 100);
    }
    return result;
  }, [showActuals, actuals, visibleResources, months, cur, workTypeFilter]);
  const hasActualTotals = Object.keys(actualTotals).length > 0;

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card overflow-auto">
      <h3 className="text-[13px] font-bold text-text px-5 pt-4 pb-2">
        Capacity Heatmap{' '}
        <InfoDot text="Each month is a small bullet: the soft track is the person’s realised allocation as % of capacity with a tick at its target (red when over 100%), the solid bar is the time they actually logged in Tempo — stacked by work type (green = client, violet = internal, slate = absences). Absences render in the stack so time off is visible where it explains a plan shortfall, but the “act” number counts worked time only. The Hours filter switches the lens to one work type or absences alone. Click a row to break the person’s hours down per client, internal work and absences; click their name to open the profile. Rows share a scale anchored at 100% capacity; people without synced hours get no actual layer. A grey bar is the current month, still being logged." />
        <ActualsLegend showAct={showActuals} types={showActuals ? typesForFilter(workTypeFilter) : null} />
      </h3>
      <div className="flex items-center border-b-2 border-border sticky top-0 bg-white z-10">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-semibold text-text-mid">Name</span>
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 text-center text-[10px] font-mono font-bold text-primary py-2">
            <span className={m === cur ? 'bg-primary-light rounded-md px-1.5 py-0.5' : ''}>{formatMonth(m)}</span>
          </div>
        ))}
      </div>
      {visibleResources.map((r) => (
        <ResourceHeatmapRow key={r.id} resource={r} months={months}
          onOpen={() => onResourceClick(r)} includePotential={includePotential}
          typedHours={showActuals ? actuals?.byResourceType?.[r.id] : null}
          workTypeFilter={workTypeFilter}
          window={actuals?.window} />
      ))}
      {/* Totals row */}
      <div className="flex items-center border-t-2 border-border bg-primary-bg/30 sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-bold text-text">Avg Utilization</span>
          {hasActualTotals && <span className="block text-[9px] font-semibold text-text-light">plan / act (matched people)</span>}
        </div>
        {months.map((m) => {
          const pct = totals[m];
          const color = utilColor(pct);
          return (
            <div key={m} className="w-[82px] shrink-0 flex flex-col items-center justify-center py-0.5">
              <span className="text-[11px] font-mono font-bold" style={{ color }}>{pct}%</span>
              {hasActualTotals && m <= cur && (
                <span className="text-[9px] font-mono font-semibold leading-tight"
                  style={{ color: m === cur ? '#9CA3AF' : '#34C98E' }}>
                  act {actualTotals[m] ?? 0}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
