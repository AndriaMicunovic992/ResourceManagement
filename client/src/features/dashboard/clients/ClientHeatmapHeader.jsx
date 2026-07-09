import { formatMonth, currentMonth } from '../../../lib/dateUtils';

export default function ClientHeatmapHeader({ months }) {
  const cur = currentMonth();
  return (
    <div className="flex items-center border-b-2 border-border sticky top-0 bg-white z-10">
      <div className="w-[270px] shrink-0 px-3 py-2 text-[14px] font-semibold text-text-mid">
        Client / Epic / Task
      </div>
      {months.map((m) => (
        <div key={m} className="w-[82px] shrink-0 text-center text-[12px] font-mono font-bold text-primary py-2">
          <span className={m === cur ? 'bg-primary-light rounded-md px-1.5 py-0.5' : ''}>{formatMonth(m)}</span>
        </div>
      ))}
    </div>
  );
}
