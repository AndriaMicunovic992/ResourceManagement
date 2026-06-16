import { utilColor, utilBg } from '../../../lib/statusUtils';

export default function HeatmapCell({ value, showDash, totalFilled, isPotential }) {
  if (showDash || value === null || value === undefined) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">—</div>
    );
  }

  const pct = Math.round(value * 100);
  const filledStr = (totalFilled != null) ? totalFilled.toFixed(1) : null;
  const isPot = isPotential;
  const color = isPot ? '#9CA3AF' : pct >= 100 ? utilColor(pct) : '#F5A623';
  const bg = isPot ? '#F3F4F6' : pct >= 100 ? utilBg(pct) : '#FFF6E8';
  const fteColor = isPot ? '#9CA3AF' : pct >= 100 ? '#5BC68A' : '#F5A623';

  return (
    <div className="w-[82px] shrink-0 flex items-center justify-center gap-1 py-0.5" style={{ backgroundColor: bg }}>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>{pct}%</span>
      {filledStr && <>
        <span className="text-[9px]" style={{ color: isPot ? '#D1D5DB' : color + '60' }}>|</span>
        <span className="text-[11px] font-mono" style={{ color: fteColor }}>{filledStr}</span>
      </>}
    </div>
  );
}
