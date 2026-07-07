import { utilColor, utilBg, actualVsPlanColor } from '../../../lib/statusUtils';

export default function ResourceUtilCell({ realisedPct, potentialPct, showPotential, actualPct, actualPartial }) {
  // actualPct only arrives for elapsed months of people with synced hours;
  // null = no act line. Logged hours with no plan still show — that's
  // unplanned work sitting on someone's month. actualPartial = month still
  // being logged → neutral color instead of a judgement against the plan.
  const showActual = actualPct != null && (actualPct > 0 || realisedPct > 0);

  if (realisedPct === 0 && (!potentialPct || potentialPct === 0) && !showActual) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">—</div>
    );
  }

  const color = utilColor(realisedPct);
  const bg = utilBg(realisedPct);

  return (
    <div className="w-[82px] shrink-0 flex flex-col items-center justify-center py-0.5" style={{ backgroundColor: bg }}>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>{Math.round(realisedPct)}%</span>
      {showActual && (
        <span className="text-[9px] font-mono font-semibold leading-tight"
          style={{ color: actualPartial ? '#9CA3AF' : actualVsPlanColor(actualPct, realisedPct) }}>
          act {Math.round(actualPct)}%
        </span>
      )}
      {showPotential && potentialPct > 0 && (
        <span className="text-[8px] font-mono" style={{ color: '#9CA3AF' }}>+{Math.round(potentialPct)}%p</span>
      )}
    </div>
  );
}
