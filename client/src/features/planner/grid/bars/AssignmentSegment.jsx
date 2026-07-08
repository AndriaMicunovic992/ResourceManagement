import { memo } from 'react';
import { shortName, initials } from '../../../../lib/resourceUtils';
import { CW } from '../../../../lib/constants';
import { plannedAbsenceDays } from '../../../../lib/availability';

/** Hero pill segment: saturated gradient, white label, avatar inside,
 * white FTE chip. contLeft/contRight mark continuation beyond the window. */
function AssignmentSegment({ segment, resource, domainColor, barHeight = 24, roundLeft, roundRight, totalSegments, showLabel = false, contLeft, contRight, overloadMonths, onClickMonth }) {
  // A separator line only sits where two segments actually touch (an FTE
  // change), not where there's a gap or a free/continuation end.
  const hasLeftSeparator = !roundLeft && !contLeft && totalSegments > 1;
  const rl = roundLeft ? 999 : contLeft ? 8 : 0;
  const rr = roundRight ? 999 : contRight ? 8 : 0;

  return (
    <div
      className="flex items-center relative"
      style={{
        width: '100%',
        height: barHeight,
        background: `linear-gradient(100deg, ${domainColor}, color-mix(in srgb, ${domainColor} 72%, white))`,
        borderRadius: `${rl}px ${rr}px ${rr}px ${rl}px`,
        boxShadow: `0 5px 12px -3px ${domainColor}99`,
      }}
    >
      {/* Segment separator line */}
      {hasLeftSeparator && (
        <div className="absolute left-0 top-[4px] bottom-[4px] w-[1px] bg-white/40" />
      )}
      {/* Per-month click zones */}
      {segment.months.map((m, mi) => {
        const offDays = plannedAbsenceDays(resource, m);
        return (
          <div
            key={m}
            className="absolute top-0 bottom-0 cursor-pointer hover:bg-white/10 transition-colors"
            style={{ left: mi * CW, width: CW }}
            title={offDays > 0 ? `${resource.name}: ${offDays}d planned off in ${m} — click to adjust or substitute` : undefined}
            onClick={(e) => { e.stopPropagation(); onClickMonth(m, e); }}
          />
        );
      })}
      {/* Planned-absence hatch: a slate strip along the bottom of months where
          this person has days off, so a bar running through a leave is visible
          right on the plan (the red tick fires when the leave makes the month
          overbooked). */}
      {segment.months.map((m, mi) => {
        const offDays = plannedAbsenceDays(resource, m);
        if (!(offDays > 0)) return null;
        return (
          <div
            key={`ab-${m}`}
            className="absolute pointer-events-none"
            style={{
              left: mi * CW + 3, width: CW - 6, bottom: 2, height: 5,
              borderRadius: 3,
              background: 'repeating-linear-gradient(45deg, #64748B 0 3px, #E2E8F0 3px 6px)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.75)',
            }}
          />
        );
      })}
      {/* Cross-project overload ticks */}
      {segment.months.map((m, mi) =>
        overloadMonths?.has(m) ? (
          <span
            key={`ov-${m}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-danger pointer-events-none"
            style={{ left: mi * CW + CW - 8, top: 2, boxShadow: '0 0 0 1.5px #fff' }}
            title="Over this person's available capacity this month (all projects, planned absences counted)"
          />
        ) : null
      )}
      {/* Visual content (non-interactive overlay) */}
      <div className="flex items-center gap-1.5 px-1.5 w-full pointer-events-none" style={{ height: barHeight }}>
        {contLeft && <span className="text-white/70 text-[11px] font-bold -ml-0.5">‹</span>}
        {showLabel && (
          <>
            <span
              className="flex items-center justify-center rounded-full text-white shrink-0"
              style={{
                width: 20, height: 20, fontSize: 8, fontWeight: 700,
                background: 'rgba(255,255,255,0.28)', border: '1.5px solid rgba(255,255,255,0.85)',
              }}
            >
              {initials(resource.name)}
            </span>
            {segment.months.length > 1 && (
              <span
                className="text-[11px] font-bold truncate text-white"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.18)' }}
              >
                {shortName(resource.name)}
              </span>
            )}
          </>
        )}
        <div className="flex-1" />
        <span
          className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: domainColor }}
        >
          {segment.fte.toFixed(2)}
        </span>
        {contRight && <span className="text-white/70 text-[11px] font-bold -mr-0.5">›</span>}
      </div>
    </div>
  );
}

export default memo(AssignmentSegment);
