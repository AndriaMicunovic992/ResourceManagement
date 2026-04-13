import { useMemo } from 'react';
import { DOMAINS } from '../../../lib/constants';
import { utilColor } from '../../../lib/statusUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';

export default function DomainCard({ domain, months, includePotential, teamId }) {
  const { resources } = useData();
  const { rURealised, rU } = useComputed();
  const d = DOMAINS[domain];

  const { count, utilPct, usedFte, totalFte } = useMemo(() => {
    const scoped = teamId ? resources.filter((r) => r.teamId === teamId) : resources;
    const domResources = scoped.filter((r) => r.roles?.some((rl) => rl.domain === domain));
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
    return {
      count,
      utilPct: avgTotal > 0 ? Math.round((avgUsed / avgTotal) * 100) : 0,
      usedFte: avgUsed,
      totalFte: avgTotal,
    };
  }, [resources, rURealised, rU, domain, months, includePotential, teamId]);

  const color = utilColor(utilPct);
  const label = includePotential ? 'all' : 'realised';

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
        <span className="text-[9px] font-mono text-text-light">{usedFte.toFixed(1)} / {totalFte.toFixed(1)} FTE ({label})</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{utilPct}%</span>
      </div>
    </div>
  );
}
