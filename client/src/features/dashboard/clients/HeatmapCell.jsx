import { utilColor, utilBg } from '../../../lib/statusUtils';

export default function HeatmapCell({ value, showDash }) {
  if (showDash || value === null || value === undefined) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">
        —
      </div>
    );
  }

  const pct = Math.round(value * 100);
  const color = utilColor(pct);
  const bg = utilBg(pct);

  return (
    <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono font-semibold"
      style={{ color, backgroundColor: bg }}>
      {pct}%
    </div>
  );
}
