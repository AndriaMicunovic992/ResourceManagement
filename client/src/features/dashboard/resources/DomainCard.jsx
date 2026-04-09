import { useMemo } from 'react';
import { DOMAINS } from '../../../lib/constants';
import { utilColor } from '../../../lib/statusUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { currentMonth } from '../../../lib/dateUtils';

export default function DomainCard({ domain }) {
  const { resources } = useData();
  const { rURealised } = useComputed();
  const d = DOMAINS[domain];
  const cm = currentMonth();

  const { count, utilPct, usedFte, totalFte } = useMemo(() => {
    const domResources = resources.filter((r) => r.roles?.some((rl) => rl.domain === domain));
    const count = domResources.length;
    let used = 0, total = 0;
    for (const r of domResources) {
      total += r.capacity;
      used += rURealised[r.id]?.[cm] || 0;
    }
    return { count, utilPct: total > 0 ? Math.round((used / total) * 100) : 0, usedFte: used, totalFte: total };
  }, [resources, rURealised, domain, cm]);

  const color = utilColor(utilPct);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: d.color }} />
          <span className="text-[13px] font-bold text-text">{domain}</span>
        </div>
        <span className="text-xs font-mono text-text-mid">{count}</span>
      </div>
      <div className="h-1.5 bg-border-light rounded-full overflow-hidden mb-1.5">
        <div className="h-full rounded-full" style={{ width: `${Math.min(utilPct, 100)}%`, backgroundColor: color }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-text-light">{usedFte.toFixed(1)} / {totalFte.toFixed(1)} FTE (realised)</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{utilPct}%</span>
      </div>
    </div>
  );
}
