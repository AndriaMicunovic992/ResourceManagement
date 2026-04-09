import { useMemo } from 'react';
import Avatar from '../../../components/ui/Avatar';
import RoleBadge from '../../../components/badges/RoleBadge';
import ProgressBar from '../../../components/ui/ProgressBar';
import HoverButtons from '../../../components/ui/HoverButtons';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';
import { useComputed } from '../../../hooks/useComputed';
import { monthRange } from '../../../lib/dateUtils';

export default function ResourceCard({ resource, selected, onSelect, onEdit, onDelete, timeRange, canEdit }) {
  const { rU } = useComputed();
  const color = domainColor(resourcePrimaryDomain(resource));

  const { avgUtil, isFullyBooked } = useMemo(() => {
    const months = monthRange(timeRange.start, timeRange.end);
    const utils = months.map((m) => (rU[resource.id]?.[m] || 0) / resource.capacity);
    const avg = utils.length > 0 ? utils.reduce((a, b) => a + b, 0) / utils.length : 0;
    return { avgUtil: avg, isFullyBooked: avg >= 0.99 };
  }, [rU, resource, timeRange]);

  if (isFullyBooked) {
    return (
      <div className="p-3 mb-2 rounded-xl border border-border bg-white opacity-40 cursor-default">
        <div className="flex items-center gap-2">
          <Avatar name={resource.name} color={color} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-text truncate">{resource.name}</div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {resource.roles?.map((r, i) => <RoleBadge key={i} {...r} small />)}
            </div>
          </div>
          <span className="text-[10px] font-mono text-text-light">full</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(resource)}
      className={`group p-3 mb-2 rounded-xl border cursor-pointer transition-all ${
        selected
          ? 'border-2 border-primary bg-gradient-to-br from-primary-light to-white shadow-md'
          : 'border-border bg-white hover:shadow-card'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <Avatar name={resource.name} color={color} size={36} />
          {selected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-white text-[8px]">✓</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-text truncate">{resource.name}</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {resource.roles?.map((r, i) => <RoleBadge key={i} {...r} small />)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {canEdit && <HoverButtons onEdit={onEdit} onDelete={onDelete} size="small" />}
          <span className="text-[10px] font-mono text-text-mid">{((1 - avgUtil) * resource.capacity).toFixed(1)}</span>
        </div>
      </div>
      <ProgressBar value={avgUtil} max={1} className="mt-2" />
    </div>
  );
}
