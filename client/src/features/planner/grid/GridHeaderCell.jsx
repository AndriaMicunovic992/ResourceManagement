import { currentMonth } from '../../../lib/dateUtils';
import { CW } from '../../../lib/constants';

export default function GridHeaderCell({ period, isFullyStaffed, gap = 0 }) {
  const isCurrent = period.months.includes(currentMonth());
  const mainColor = isFullyStaffed ? '#5BC68A' : isCurrent ? '#4CBAD4' : '#6B8A9E';
  const subColor = isCurrent ? '#4CBAD4' : '#A8BDCB';
  const width = period.months.length * CW;

  // "Jun '26" → JUN over '26 ; "Q3 '26" → Q3 over '26 ; "'26" → just '26.
  const parts = period.label.split(' ');
  const sub = parts.length > 1 ? parts[0].toUpperCase() : null;
  const main = parts.length > 1 ? parts[1] : period.label;

  return (
    <div
      className="relative flex flex-col items-center justify-start shrink-0 pt-2"
      style={{ width, height: 44 }}
    >
      {sub && (
        <span className="text-[8.5px] font-bold tracking-[0.1em]" style={{ color: subColor }}>
          {sub}
        </span>
      )}
      <span className="font-mono text-[11px] font-bold leading-tight" style={{ color: mainColor }}>
        {main}
      </span>
      {gap > 0.001 && (
        <span
          className="px-1.5 rounded-md bg-danger-bg text-danger text-[8.5px] font-mono font-bold leading-[13px] mt-0.5"
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
