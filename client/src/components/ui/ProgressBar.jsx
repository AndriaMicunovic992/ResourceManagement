import { utilColor } from '../../lib/statusUtils';

export default function ProgressBar({ value, max = 1, className = '' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = utilColor(pct);
  return (
    <div className={`h-1.5 bg-border-light rounded-full overflow-hidden ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}
