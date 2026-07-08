import { useMemo, useState } from 'react';
import Avatar from '../../../components/ui/Avatar';
import ResourceUtilCell from './ResourceUtilCell';
import ResourceBreakdownRows from './ResourceBreakdownRows';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { utilColor } from '../../../lib/statusUtils';
import { MONTHLY_HOURS_PER_FTE } from '../../../lib/constants';
import { currentMonth, formatMonth } from '../../../lib/dateUtils';
import { hoursForFilter, segmentsForFilter, stackTotalForFilter } from '../workTypeLens';
import { plannedAbsenceDays, plannedAvailabilityRatio } from '../../../lib/availability';
import { useComputed } from '../../../hooks/useComputed';

export default function ResourceHeatmapRow({ resource, months, onOpen, includePotential, typedHours, workTypeFilter = 'work', window: win }) {
  const { rURealised, rU } = useComputed();
  const [expanded, setExpanded] = useState(false);
  const color = domainColor(resourcePrimaryDomain(resource));
  const cur = currentMonth();

  // People with no synced hours under the current lens get no actual layer
  // (they're likely not matched to a Jira account) instead of a wall of zeros.
  const hasActualHours = useMemo(
    () => !!typedHours && Object.values(typedHours).some((t) => hoursForFilter(t, workTypeFilter) > 0),
    [typedHours, workTypeFilter]
  );
  const canExpand = !!typedHours && Object.values(typedHours).some((t) => hoursForFilter(t, 'work') > 0 || (t.absence || 0) > 0);

  const { avgPct, actAvgPct, monthData, rowMax } = useMemo(() => {
    const data = {};
    let sum = 0, count = 0;
    let actSum = 0, actCount = 0;
    // Anchor the row scale at 100% so a full capacity reads the same width on
    // every row; only overbooked plans or heavy logging stretch it further.
    let max = 100;
    const cap = resource.capacity || 1;
    const toPct = (hours) => (hours / MONTHLY_HOURS_PER_FTE / cap) * 100;
    for (const m of months) {
      const realised = (rURealised[resource.id]?.[m] || 0) / cap * 100;
      const total = (rU[resource.id]?.[m] || 0) / cap * 100;
      const potential = Math.max(0, total - realised);
      const types = typedHours?.[m];
      const actual = hasActualHours && m <= cur ? toPct(hoursForFilter(types, workTypeFilter)) : null;
      const segments = actual != null && m !== cur
        ? segmentsForFilter(types, workTypeFilter).map((s) => ({ ...s, value: toPct(s.value) }))
        : null;
      data[m] = { realisedPct: realised, potentialPct: potential, actualPct: actual, actSegments: segments, actualPartial: m === cur };
      // The stack can be longer than the Actual number (absences render but
      // don't count as worked time) — scale the row to the full stack.
      const stackPct = actual != null ? toPct(stackTotalForFilter(types, workTypeFilter)) : 0;
      max = Math.max(max, includePotential ? realised + potential : realised, actual || 0, stackPct);
      if (realised > 0 || total > 0) { sum += realised; count++; }
      // The act average covers completed months only — the in-progress month
      // would drag it down while hours are still being logged.
      if (actual != null && m < cur && (actual > 0 || realised > 0)) { actSum += actual; actCount++; }
    }
    return {
      avgPct: count > 0 ? Math.round(sum / count) : 0,
      actAvgPct: actCount > 0 ? Math.round(actSum / actCount) : null,
      monthData: data,
      rowMax: max,
    };
  }, [rURealised, rU, resource, months, hasActualHours, typedHours, workTypeFilter, cur, includePotential]);

  const avgColor = utilColor(avgPct);

  return (
    <>
      <div className={`flex items-center border-b border-border-light hover:bg-primary-bg/30 ${canExpand ? 'cursor-pointer' : ''}`}
        onClick={canExpand ? () => setExpanded((v) => !v) : undefined}>
        <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
          <span className={`text-[10px] w-3 shrink-0 transition-transform ${canExpand ? 'text-text-mid' : 'text-transparent'}`}
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          <Avatar name={resource.name} color={color} size={28} className="text-[10px]" />
          <div className="flex-1 min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="block text-xs font-semibold text-text truncate bg-transparent border-0 p-0 cursor-pointer hover:text-primary hover:underline text-left"
              title="Open profile"
            >
              {resource.name}
            </button>
            <div className="text-[10px] font-mono" style={{ color: avgColor }}>
              {avgPct}% avg
              {actAvgPct != null && <span className="text-text-light"> · act {actAvgPct}%</span>}
            </div>
          </div>
        </div>
        {months.map((m) => {
          const d = monthData[m];
          // Planned days off matter for the months AHEAD (elapsed months judge
          // against synced absences instead): the tick turns red when the plan
          // exceeds what's left of the month after the leave.
          const offDays = m >= cur ? plannedAbsenceDays(resource, m) : 0;
          return (
            <ResourceUtilCell key={m} title={`${resource.name} · ${formatMonth(m)}`}
              plan={d.realisedPct} extra={includePotential ? d.potentialPct : 0} act={d.actualPct}
              actSegments={d.actSegments} typedHours={typedHours?.[m]}
              capacity={resource.capacity || 1} workTypeFilter={workTypeFilter}
              plannedOffDays={offDays}
              plannedAvailPct={offDays > 0 ? plannedAvailabilityRatio(resource, m) * 100 : null}
              max={rowMax} accent={color} actualPartial={d.actualPartial} />
          );
        })}
      </div>
      {expanded && (
        <ResourceBreakdownRows resource={resource} months={months} typedHours={typedHours} window={win} accent={color} />
      )}
    </>
  );
}
