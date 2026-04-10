import { utilColor, utilBg } from '../../../lib/statusUtils';

export default function HeatmapCell({ value, showDash, totalFilled, isPotential }) {
  if (showDash || value === null || value === undefined) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">
        —
      </div>
    );
  }

  const pct = Math.round(value * 100);
  const filledStr = (totalFilled != null) ? totalFilled.toFixed(1) : null;

  // Potential cells: grey
  if (isPotential) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center gap-1 py-0.5"
        style={{ backgroundColor: '#F3F4F6' }}>
        <span className="text-[11px] font-mono font-semibold" style={{ color: '#9CA3AF' }}>{pct}%</span>
        {filledStr && <>
          <span className="text-[9px]" style={{ color: '#D1D5DB' }}>|</span>
          <span className="text-[11px] font-mono" style={{ color: '#9CA3AF' }}>{filledStr}</span>
        </>}
      </div>
    );
  }

  const color = pct >= 100 ? utilColor(pct) : '#F5A623';
  const bg = pct >= 100 ? utilBg(pct) : '#FFF6E8';
  const fteColor = pct >= 100 ? '#5BC68A' : '#F5A623';

  return (
    <div className="w-[82px] shrink-0 flex items-center justify-center gap-1 py-0.5"
      style={{ backgroundColor: bg }}>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>{pct}%</span>
      {filledStr && <>
        <span className="text-[9px]" style={{ color: color + '60' }}>|</span>
        <span className="text-[11px] font-mono" style={{ color: fteColor }}>{filledStr}</span>
      </>}
    </div>
  );
}
