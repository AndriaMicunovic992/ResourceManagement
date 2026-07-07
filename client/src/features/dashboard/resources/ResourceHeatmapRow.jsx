import { useMemo } from 'react';
import Avatar from '../../../components/ui/Avatar';
import ResourceUtilCell from './ResourceUtilCell';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { utilColor } from '../../../lib/statusUtils';
import { MONTHLY_HOURS_PER_FTE } from '../../../lib/constants';
import { currentMonth } from '../../../lib/dateUtils';
import { useComputed } from '../../../hooks/useComputed';

export default function ResourceHeatmapRow({ resource, months, onClick, includePotential, actualHours }) {
  const { rURealised, rU } = useComputed();
  const color = domainColor(resourcePrimaryDomain(resource));
  const cur = currentMonth();

  // People with no synced hours in the window get no act layer (they're likely
  // not matched to a Jira account) instead of a misleading wall of zeros.
  const hasActualHours = !!actualHours && Object.values(actualHours).some((h) => h > 0);

  const { avgPct, actAvgPct, monthData, hasPotential } = useMemo(() => {
    const data = {};
    let sum = 0, count = 0;
    let actSum = 0, actCount = 0;
    let anyPotential = false;
    for (const m of months) {
      const realised = (rURealised[resource.id]?.[m] || 0) / resource.capacity * 100;
      const total = (rU[resource.id]?.[m] || 0) / resource.capacity * 100;
      const potential = total - realised;
      const actual = hasActualHours && m <= cur
        ? ((actualHours[m] || 0) / MONTHLY_HOURS_PER_FTE / (resource.capacity || 1)) * 100
        : null;
      data[m] = { realisedPct: realised, potentialPct: potential > 0 ? potential : 0, actualPct: actual, actualPartial: m === cur };
      if (potential > 0) anyPotential = true;
      if (realised > 0 || total > 0) { sum += realised; count++; }
      // The act average covers completed months only — the in-progress month
      // would drag it down while hours are still being logged.
      if (actual != null && m < cur && (actual > 0 || realised > 0)) { actSum += actual; actCount++; }
    }
    return {
      avgPct: count > 0 ? Math.round(sum / count) : 0,
      actAvgPct: actCount > 0 ? Math.round(actSum / actCount) : null,
      monthData: data,
      hasPotential: anyPotential,
    };
  }, [rURealised, rU, resource, months, hasActualHours, actualHours, cur]);

  // When includePotential is off, hide resources that only have potential allocations
  if (!includePotential && !hasPotential && avgPct === 0) {
    // still show — they have no allocations at all
  }

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
      {months.map((m) => (
        <ResourceUtilCell key={m} {...monthData[m]} showPotential={includePotential} />
      ))}
    </div>
  );
}
