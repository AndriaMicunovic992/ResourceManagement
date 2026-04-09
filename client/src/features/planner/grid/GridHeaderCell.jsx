import { currentMonth } from '../../../lib/dateUtils';
import { CW } from '../../../lib/constants';

export default function GridHeaderCell({ period, isFullyStaffed }) {
  const isCurrent = period.months.includes(currentMonth());
  const color = isFullyStaffed ? '#5BC68A' : isCurrent ? '#4CBAD4' : '#6B8A9E';
  const width = period.months.length * CW;

  return (
    <div className="relative flex flex-col items-center justify-center shrink-0" style={{ width, height: 36 }}>
      <span className="font-mono text-[10px] font-bold" style={{ color }}>
        {period.label}
      </span>
      {isCurrent && (
        <span className="absolute bottom-0.5 px-1.5 py-0 rounded bg-primary text-white text-[7px] font-bold">
          Today
        </span>
      )}
      {isFullyStaffed && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-success" />
      )}
    </div>
  );
}
