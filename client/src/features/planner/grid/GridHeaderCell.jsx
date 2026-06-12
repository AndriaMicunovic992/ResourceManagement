import { currentMonth } from '../../../lib/dateUtils';
import { CW } from '../../../lib/constants';

export default function GridHeaderCell({ period, isFullyStaffed, gap = 0 }) {
  const isCurrent = period.months.includes(currentMonth());
  const color = isFullyStaffed ? '#5BC68A' : isCurrent ? '#4CBAD4' : '#6B8A9E';
  const width = period.months.length * CW;

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-0.5 shrink-0"
      style={{ width, height: 44 }}
    >
      <span className="font-mono text-[10.5px] font-bold" style={{ color }}>
        {period.label}
      </span>
      {gap > 0.001 && (
        <span
          className="px-1.5 rounded-md bg-danger-bg text-danger text-[8.5px] font-mono font-bold leading-[13px]"
          title={`${gap.toFixed(1)} FTE unfilled in this period`}
        >
          −{gap.toFixed(1)}
        </span>
      )}
      {isFullyStaffed && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
      )}
    </div>
  );
}
