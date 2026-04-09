export default function TimeRangePicker({ timeRange, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input type="month" value={timeRange.start}
        onChange={(e) => onChange({ ...timeRange, start: e.target.value })}
        className="px-2 py-1 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary" />
      <span className="text-text-light text-xs">→</span>
      <input type="month" value={timeRange.end}
        onChange={(e) => onChange({ ...timeRange, end: e.target.value })}
        className="px-2 py-1 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary" />
    </div>
  );
}
