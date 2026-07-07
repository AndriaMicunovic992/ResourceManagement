import { memo } from 'react';
import { utilColor, utilBg, actualVsPlanColor } from '../../../lib/statusUtils';

function HeatmapCell({ value, showDash, totalFilled, isPotential, actual, actualPartial }) {
  // `actual` (FTE, may be 0) only arrives for elapsed months of rows that have
  // synced hours; null = no act layer for this cell. An actual with no plan
  // behind it still renders under the dash — that's unplanned work.
  // `actualPartial` = the month is still being logged, so the value renders
  // neutral instead of being judged against a full-month plan.
  const showActual = actual != null && (actual > 0 || (!showDash && value != null));
  const noPlan = showDash || value === null || value === undefined;

  if (noPlan && !showActual) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">—</div>
    );
  }

  const pct = noPlan ? null : Math.round(value * 100);
  const filledStr = (!noPlan && totalFilled != null) ? totalFilled.toFixed(1) : null;
  const isPot = isPotential;
  const color = isPot ? '#9CA3AF' : pct == null ? '#A0BCC9' : pct >= 100 ? utilColor(pct) : '#F5A623';
  const bg = isPot ? '#F3F4F6' : pct == null ? 'transparent' : pct >= 100 ? utilBg(pct) : '#FFF6E8';
  const fteColor = isPot ? '#9CA3AF' : pct >= 100 ? '#5BC68A' : '#F5A623';
  const actColor = isPot || actualPartial ? '#9CA3AF' : actualVsPlanColor(actual, noPlan ? 0 : totalFilled);

  return (
    <div className="w-[82px] shrink-0 flex flex-col items-center justify-center py-0.5" style={{ backgroundColor: bg }}>
      <div className="flex items-center justify-center gap-1">
        {pct == null ? (
          <span className="text-[11px] font-mono text-text-light">—</span>
        ) : (
          <>
            <span className="text-[11px] font-mono font-semibold" style={{ color }}>{pct}%</span>
            {filledStr && <>
              <span className="text-[9px]" style={{ color: isPot ? '#D1D5DB' : color + '60' }}>|</span>
              <span className="text-[11px] font-mono" style={{ color: fteColor }}>{filledStr}</span>
            </>}
          </>
        )}
      </div>
      {showActual && (
        <div className="text-[9px] font-mono font-semibold leading-tight" style={{ color: actColor }}>
          act {actual.toFixed(1)}
        </div>
      )}
    </div>
  );
}

// Pure presentational leaf — memoized (one per customer/project × month).
export default memo(HeatmapCell);
