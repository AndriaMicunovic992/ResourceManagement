import { MONTHS } from '../../lib/constants';

function monthAbbr(m) {
  const i = parseInt((m || '').slice(5), 10) - 1;
  return MONTHS[i] || m;
}

/**
 * Grouped monthly bars: planned (teal) vs actual (green), in hours.
 * data: [{ month: "YYYY-MM", planned: number, actual: number }]
 */
export default function PlannedVsActualChart({ data, height = 120 }) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-text-light py-6 text-center">No data for this range.</div>;
  }
  const max = Math.max(1, ...data.flatMap((d) => [d.planned || 0, d.actual || 0]));
  const barAreaH = height - 16;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1.5 text-[10px] text-text-mid">
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#4CBAD4]" /> Planned</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#34C98E]" /> Actual</span>
      </div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => {
          const ph = Math.max(1, ((d.planned || 0) / max) * barAreaH);
          const ah = Math.max(1, ((d.actual || 0) / max) * barAreaH);
          return (
            <div key={d.month} className="flex flex-col items-center justify-end flex-1 min-w-0" style={{ height }}>
              <div
                className="flex items-end gap-[2px] flex-1"
                title={`${monthAbbr(d.month)} · planned ${Math.round(d.planned || 0)}h · actual ${Math.round(d.actual || 0)}h`}
              >
                <div className="w-2 rounded-t bg-[#4CBAD4]" style={{ height: ph }} />
                <div className="w-2 rounded-t bg-[#34C98E]" style={{ height: ah }} />
              </div>
              <div className="text-[8px] font-mono text-text-light mt-1">{monthAbbr(d.month)[0]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
