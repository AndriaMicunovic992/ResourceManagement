import { useMemo } from 'react';
import ResourceHeatmapRow from './ResourceHeatmapRow';
import { formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { utilColor } from '../../../lib/statusUtils';

export default function ResourceHeatmap({ months, onResourceClick, includePotential, teamId }) {
  const { resources } = useData();
  const { rURealised, rU } = useComputed();

  const visibleResources = useMemo(
    () => (teamId ? resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)) : resources),
    [resources, teamId]
  );

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

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-auto">
      <h3 className="text-base font-bold text-text px-5 pt-4 pb-2">Capacity Heatmap</h3>
      <div className="flex items-center border-b-2 border-border sticky top-0 bg-white z-10">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-semibold text-text-mid">Name</span>
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 text-center text-[10px] font-mono font-bold text-primary py-2">
            {formatMonth(m)}
          </div>
        ))}
      </div>
      {visibleResources.map((r) => (
        <ResourceHeatmapRow key={r.id} resource={r} months={months}
          onClick={() => onResourceClick(r)} includePotential={includePotential} />
      ))}
      {/* Totals row */}
      <div className="flex items-center border-t-2 border-border bg-primary-bg/30 sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-bold text-text">Avg Utilization</span>
        </div>
        {months.map((m) => {
          const pct = totals[m];
          const color = utilColor(pct);
          return (
            <div key={m} className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono font-bold"
              style={{ color }}>
              {pct}%
            </div>
          );
        })}
      </div>
    </div>
  );
}
