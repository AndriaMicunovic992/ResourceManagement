import { useMemo } from 'react';
import Avatar from '../../../components/ui/Avatar';
import ResourceUtilCell from './ResourceUtilCell';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { utilColor } from '../../../lib/statusUtils';
import { useComputed } from '../../../hooks/useComputed';

export default function ResourceHeatmapRow({ resource, months, onClick }) {
  const { rURealised, rU } = useComputed();
  const color = domainColor(resourcePrimaryDomain(resource));

  const { avgPct, monthData } = useMemo(() => {
    const data = {};
    let sum = 0, count = 0;
    for (const m of months) {
      const realised = (rURealised[resource.id]?.[m] || 0) / resource.capacity * 100;
      const total = (rU[resource.id]?.[m] || 0) / resource.capacity * 100;
      const potential = total - realised;
      data[m] = { realisedPct: realised, potentialPct: potential > 0 ? potential : 0 };
      if (realised > 0 || total > 0) { sum += realised; count++; }
    }
    return { avgPct: count > 0 ? Math.round(sum / count) : 0, monthData: data };
  }, [rURealised, rU, resource, months]);

  const avgColor = utilColor(avgPct);

  return (
    <div className="flex items-center border-b border-border-light cursor-pointer hover:bg-primary-bg/30"
      onClick={onClick}>
      <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
        <Avatar name={resource.name} color={color} size={28} className="text-[10px]" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-text truncate">{resource.name}</div>
          <div className="text-[10px] font-mono" style={{ color: avgColor }}>{avgPct}% avg</div>
        </div>
      </div>
      {months.map((m) => (
        <ResourceUtilCell key={m} {...monthData[m]} />
      ))}
    </div>
  );
}
