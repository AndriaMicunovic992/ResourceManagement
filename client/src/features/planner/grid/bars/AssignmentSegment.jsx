import BarAvatar from './BarAvatar';
import { shortName, initials } from '../../../../lib/resourceUtils';
import { CW } from '../../../../lib/constants';

export default function AssignmentSegment({ segment, resource, domainColor, barHeight = 24, isFirst, isLast, totalSegments, showLabel = isFirst, overloadMonths, onClickMonth }) {
  const width = segment.months.length * CW;
  const hasLeftSeparator = !isFirst && totalSegments > 1;

  return (
    <div
      className="flex items-center relative"
      style={{
        width,
        height: barHeight,
        backgroundColor: domainColor + '33',
        borderTop: `1.5px solid ${domainColor}55`,
        borderBottom: `1.5px solid ${domainColor}55`,
        borderLeft: isFirst ? `1.5px solid ${domainColor}55` : 'none',
        borderRight: isLast ? `1.5px solid ${domainColor}55` : 'none',
        borderRadius: isFirst && isLast ? 12 : isFirst ? '12px 0 0 12px' : isLast ? '0 12px 12px 0' : 0,
        boxShadow: '0 2px 6px rgba(44,62,80,0.12)',
      }}
    >
      {/* Segment separator line */}
      {hasLeftSeparator && (
        <div className="absolute left-0 top-[3px] bottom-[3px] w-[1px]" style={{ backgroundColor: domainColor + '40' }} />
      )}
      {/* Per-month click zones */}
      {segment.months.map((m, mi) => (
        <div
          key={m}
          className="absolute top-0 bottom-0 cursor-pointer hover:bg-black/[0.04] transition-colors"
          style={{ left: mi * CW, width: CW }}
          onClick={(e) => { e.stopPropagation(); onClickMonth(m, e); }}
        />
      ))}
      {/* Cross-project overload ticks */}
      {segment.months.map((m, mi) =>
        overloadMonths?.has(m) ? (
          <span
            key={`ov-${m}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-danger pointer-events-none"
            style={{ left: mi * CW + CW - 7, top: 2 }}
            title="Over capacity this month across all projects"
          />
        ) : null
      )}
      {/* Visual content (non-interactive overlay) */}
      <div className="flex items-center gap-1 px-1 w-full pointer-events-none" style={{ height: barHeight }}>
        {showLabel && (
          <>
            <BarAvatar name={resource.name} color={domainColor} size={18} />
            <span className="text-[9px] font-semibold truncate" style={{ color: domainColor }}>
              {segment.months.length === 1 ? initials(resource.name) : shortName(resource.name)}
            </span>
          </>
        )}
        <div className="flex-1" />
        <span className="text-[8.5px] font-mono font-bold px-1.5 rounded-full shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: domainColor }}>
          {segment.fte.toFixed(2)}{isLast ? ' ›' : ''}
        </span>
      </div>
    </div>
  );
}
