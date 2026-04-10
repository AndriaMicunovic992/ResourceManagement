import { utilColor, utilBg } from '../../../lib/statusUtils';

export default function HeatmapCell({ value, showDash, totalNeeded, totalFilled, isPotential }) {
  if (showDash || value === null || value === undefined) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">
        —
      </div>
    );
  }

  const pct = Math.round(value * 100);

  // Potential cells: grey
  if (isPotential) {
    return (
      <div className="w-[82px] shrink-0 flex flex-col items-center justify-center py-0.5"
        style={{ backgroundColor: '#F3F4F6' }}>
        <span className="text-[11px] font-mono font-semibold" style={{ color: '#9CA3AF' }}>{pct}%</span>
        {totalNeeded > 0 && (
          <span className="text-[8px] font-mono" style={{ color: '#9CA3AF' }}>{totalFilled.toFixed(1)}/{totalNeeded.toFixed(1)}</span>
        )}
      </div>
    );
  }

  const color = pct >= 100 ? utilColor(pct) : '#F5A623';
  const bg = pct >= 100 ? utilBg(pct) : '#FFF6E8';

  return (
    <div className="w-[82px] shrink-0 flex flex-col items-center justify-center py-0.5"
      style={{ color, backgroundColor: bg }}>
      <span className="text-[11px] font-mono font-semibold">{pct}%</span>
      {totalNeeded > 0 && (
        <span className="text-[8px] font-mono" style={{ color: pct >= 100 ? '#5BC68A' : '#F5A623' }}>{totalFilled.toFixed(1)}/{totalNeeded.toFixed(1)}</span>
      )}
    </div>
  );
}
