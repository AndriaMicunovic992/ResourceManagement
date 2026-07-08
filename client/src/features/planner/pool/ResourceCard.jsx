import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../../components/ui/Avatar';
import { CalendarMinusIcon } from '../../../components/ui/icons';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { seniorityShort } from '../../../lib/taxonomy';
import { useComputed } from '../../../hooks/useComputed';
import { monthRange } from '../../../lib/dateUtils';
import { effectiveCapacity, plannedAbsenceDays } from '../../../lib/availability';

/**
 * Compact pool row: name + roles line + free-capacity number, with a thin
 * utilization bar. Capacity is the EFFECTIVE capacity — planned days off
 * (entered via the calendar button) shrink what's bookable, so someone on
 * leave stops looking free. Color semantics: red ONLY for overbooked, green
 * for healthy-full, slate for underused (underutilization is not an error).
 */
export default function ResourceCard({ resource, selected, onSelect, timeRange, onAbsence }) {
  const { rU } = useComputed();
  const color = domainColor(resourcePrimaryDomain(resource));

  const { avgUtil, free, isFullyBooked, absDays, allOff } = useMemo(() => {
    const months = monthRange(timeRange.start, timeRange.end);
    let loadSum = 0, effSum = 0, days = 0;
    for (const m of months) {
      loadSum += rU[resource.id]?.[m] || 0;
      effSum += effectiveCapacity(resource, m);
      days += plannedAbsenceDays(resource, m);
    }
    const n = Math.max(1, months.length);
    // Utilization of what's actually available; a fully-off window with any
    // load reads as overbooked (there is nothing to book against).
    const util = effSum > 0.001 ? loadSum / effSum : loadSum > 0.001 ? 2 : 1;
    const freeAvg = (effSum - loadSum) / n;
    return {
      avgUtil: util,
      free: freeAvg,
      isFullyBooked: freeAvg > -0.001 && freeAvg <= 0.011,
      absDays: days,
      allOff: effSum <= 0.001 && loadSum <= 0.001,
    };
  }, [rU, resource, timeRange]);

  const over = free < -0.001;
  const barColor = over ? '#E8636F' : avgUtil >= 0.8 ? '#5BC68A' : '#94A3B8';
  const rolesLine = (resource.roles || [])
    .map((rl) => `${rl.domain.slice(0, 3)} ${rl.role}·${seniorityShort(rl.seniority)}`)
    .join(' · ');
  const dimmed = isFullyBooked && !selected;

  return (
    <div
      onClick={dimmed ? undefined : () => onSelect(resource)}
      className={`group rounded-[10px] px-2 py-1.5 mb-0.5 transition-colors ${
        selected
          ? 'bg-primary-light shadow-[inset_0_0_0_1.5px_#4CBAD4]'
          : dimmed
            ? 'opacity-45 cursor-default'
            : 'cursor-pointer hover:bg-primary-bg'
      }`}
    >
      <div className="flex items-center gap-2">
        <Link to={`/people/${resource.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Avatar name={resource.name} color={color} size={26} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-text truncate leading-tight">{resource.name}</div>
          <div className="text-[9.5px] font-mono text-text-mid truncate">{rolesLine}</div>
        </div>
        {absDays > 0 && (
          <span
            className="text-[8.5px] font-mono font-bold text-slate-500 bg-slate-100 rounded-full px-1.5 py-px shrink-0"
            title={`${absDays} planned day${absDays === 1 ? '' : 's'} off in this window`}
          >
            {absDays}d off
          </span>
        )}
        {onAbsence && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onAbsence(resource, { x: rect.right + 8, y: rect.top - 8 });
            }}
            className={`shrink-0 border-0 bg-transparent cursor-pointer p-0.5 rounded text-text-light hover:text-slate-600 hover:bg-slate-100 transition-opacity ${
              absDays > 0 ? '' : 'opacity-0 group-hover:opacity-100'
            }`}
            title="Planned days off"
          >
            <CalendarMinusIcon size={12} />
          </button>
        )}
        <span
          className={`text-[10px] font-mono shrink-0 ${
            over ? 'text-danger font-bold' : free > 0.05 ? 'text-text-mid' : 'text-text-light'
          }`}
          title={over ? 'Overbooked on average in this window (planned absences counted)' : 'Average free capacity in this window, minus planned absences'}
        >
          {over ? free.toFixed(1) : allOff ? 'off' : isFullyBooked ? 'full' : `+${Math.max(0, free).toFixed(1)}`}
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-border-light overflow-hidden ml-[34px] mt-1">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, avgUtil * 100)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
