import { utilColor, utilBg } from '../../../lib/statusUtils';

export default function ResourceUtilCell({ realisedPct, potentialPct, showPotential, actualPct }) {
  const hasActual = actualPct != null && actualPct > 0;
  if (realisedPct === 0 && (!potentialPct || potentialPct === 0) && !hasActual) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">—</div>
    );
  }

  const color = utilColor(realisedPct);
  const bg = utilBg(realisedPct);

  return (
    <div className="w-[82px] shrink-0 flex flex-col items-center justify-center py-0.5" style={{ backgroundColor: bg }}>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>{Math.round(realisedPct)}%</span>
      {showPotential && potentialPct > 0 && (
        <span className="text-[8px] font-mono" style={{ color: '#9CA3AF' }}>+{Math.round(potentialPct)}%p</span>
      )}
      {hasActual && (
        <span className="text-[8px] font-mono font-semibold" style={{ color: '#34C98E' }}>act {Math.round(actualPct)}%</span>
      )}
    </div>
  );
}
