import { useMemo } from 'react';
import Avatar from '../../../components/ui/Avatar';
import ResourceUtilCell from './ResourceUtilCell';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { utilColor } from '../../../lib/statusUtils';
import { MONTHLY_HOURS_PER_FTE } from '../../../lib/constants';
import { currentMonth, formatMonth } from '../../../lib/dateUtils';
import { useComputed } from '../../../hooks/useComputed';

export default function ResourceHeatmapRow({ resource, months, onClick, includePotential, actualHours }) {
  const { rURealised, rU } = useComputed();
  const color = domainColor(resourcePrimaryDomain(resource));
  const cur = currentMonth();

  // People with no synced hours in the window get no actual layer (they're
  // likely not matched to a Jira account) instead of a misleading wall of zeros.
  const hasActualHours = !!actualHours && Object.values(actualHours).some((h) => h > 0);

  const { avgPct, actAvgPct, monthData, rowMax } = useMemo(() => {
    const data = {};
    let sum = 0, count = 0;
    let actSum = 0, actCount = 0;
    // Anchor the row scale at 100% so a full capacity reads the same width on
    // every row; only overbooked plans or heavy logging stretch it further.
    let max = 100;
    for (const m of months) {
      const realised = (rURealised[resource.id]?.[m] || 0) / resource.capacity * 100;
      const total = (rU[resource.id]?.[m] || 0) / resource.capacity * 100;
      const potential = Math.max(0, total - realised);
      const actual = hasActualHours && m <= cur
        ? ((actualHours[m] || 0) / MONTHLY_HOURS_PER_FTE / (resource.capacity || 1)) * 100
        : null;
      data[m] = { realisedPct: realised, potentialPct: potential, actualPct: actual, actualPartial: m === cur };
      max = Math.max(max, includePotential ? realised + potential : realised, actual || 0);
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
  }, [rURealised, rU, resource, months, hasActualHours, actualHours, cur, includePotential]);

  const avgColor = utilColor(avgPct);

  return (
    <div className="flex items-center border-b border-border-light cursor-pointer hover:bg-primary-bg/30"
      onClick={onClick}>
      <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
        <Avatar name={resource.name} color={color} size={28} className="text-[10px]" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-text truncate">{resource.name}</div>
          <div className="text-[10px] font-mono" style={{ color: avgColor }}>
            {avgPct}% avg
            {actAvgPct != null && <span className="text-text-light"> · act {actAvgPct}%</span>}
          </div>
        </div>
      </div>
      {months.map((m) => {
        const d = monthData[m];
        return (
          <ResourceUtilCell key={m} title={`${resource.name} · ${formatMonth(m)}`}
            plan={d.realisedPct} extra={includePotential ? d.potentialPct : 0} act={d.actualPct}
            max={rowMax} accent={color} actualPartial={d.actualPartial} />
        );
      })}
    </div>
  );
}
