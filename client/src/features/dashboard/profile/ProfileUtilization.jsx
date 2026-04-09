import { useMemo } from 'react';
import { useComputed } from '../../../hooks/useComputed';
import { monthRange, currentMonth, addMonths, formatMonth } from '../../../lib/dateUtils';
import { utilColor, utilBg } from '../../../lib/statusUtils';

export default function ProfileUtilization({ resource }) {
  const { rURealised } = useComputed();
  const months = useMemo(() => monthRange(currentMonth(), addMonths(currentMonth(), 11)), []);

  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">Monthly Utilization</div>
      <div className="flex gap-1 overflow-x-auto">
        {months.map((m) => {
          const used = rURealised[resource.id]?.[m] || 0;
          const pct = Math.round((used / resource.capacity) * 100);
          const color = utilColor(pct);
          const bg = utilBg(pct);
          return (
            <div key={m} className="flex flex-col items-center rounded-lg p-1.5 min-w-[50px]"
              style={{ backgroundColor: bg }}>
              <span className="text-[8px] font-mono text-text-light">{formatMonth(m)}</span>
              <span className="text-xs font-bold font-mono" style={{ color }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
