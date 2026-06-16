import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../../components/ui/Avatar';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { seniorityShort } from '../../../lib/taxonomy';
import { useComputed } from '../../../hooks/useComputed';
import { monthRange } from '../../../lib/dateUtils';

/**
 * Compact pool row: name + roles line + free-capacity number, with a thin
 * utilization bar. Color semantics: red ONLY for overbooked, green for
 * healthy-full, slate for underused (underutilization is not an error).
 */
export default function ResourceCard({ resource, selected, onSelect, timeRange }) {
  const { rU } = useComputed();
  const color = domainColor(resourcePrimaryDomain(resource));

  const { avgUtil, free, isFullyBooked } = useMemo(() => {
    const months = monthRange(timeRange.start, timeRange.end);
    const utils = months.map((m) => (rU[resource.id]?.[m] || 0) / resource.capacity);
    const avg = utils.length > 0 ? utils.reduce((a, b) => a + b, 0) / utils.length : 0;
    return {
      avgUtil: avg,
      free: (1 - avg) * resource.capacity,
      isFullyBooked: avg >= 0.99 && avg <= 1.001,
    };
  }, [rU, resource, timeRange]);

  const over = avgUtil > 1.001;
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
        <span
          className={`text-[10px] font-mono shrink-0 ${
            over ? 'text-danger font-bold' : free > 0.05 ? 'text-text-mid' : 'text-text-light'
          }`}
          title={over ? 'Overbooked on average in this window' : 'Average free capacity in this window'}
        >
          {over ? free.toFixed(1) : isFullyBooked ? 'full' : `+${Math.max(0, free).toFixed(1)}`}
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
