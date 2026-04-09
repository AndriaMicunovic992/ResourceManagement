import { formatMonth } from '../../../lib/dateUtils';

export default function ClientHeatmapHeader({ months }) {
  return (
    <div className="flex items-center border-b-2 border-border sticky top-0 bg-white z-10">
      <div className="w-[270px] shrink-0 px-3 py-2 text-xs font-semibold text-text-mid">
        Client / Project
      </div>
      {months.map((m) => (
        <div key={m} className="w-[82px] shrink-0 text-center text-[10px] font-mono font-bold text-primary py-2">
          {formatMonth(m)}
        </div>
      ))}
    </div>
  );
}
