const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatBucketLabel(bucketStart, bucket) {
  if (typeof bucketStart !== 'string') return String(bucketStart);
  if (bucket === 'quarter') {
    const m = bucketStart.match(/^(\d{4})-Q([1-4])$/);
    if (!m) return bucketStart;
    return `Q${m[2]} ${m[1]}`;
  }
  const m = bucketStart.match(/^(\d{4})-(\d{2})$/);
  if (!m) return bucketStart;
  return `${MONTH_SHORT[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

export default function TrendChart({ points, bucket, selectedBuckets = [], onPointClick }) {
  if (!points || points.length === 0) {
    return (
      <div className="text-[11px] text-text-light italic py-6 text-center">
        No finalized evaluations yet — the trend chart will appear once evaluations are finalized.
      </div>
    );
  }
  const width = 560;
  const height = 140;
  const padding = { top: 12, right: 12, bottom: 24, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const minY = 1;
  const maxY = 5;
  const n = points.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const clickable = typeof onPointClick === 'function';

  const xy = points.map((p, i) => {
    const x = padding.left + (n > 1 ? i * stepX : innerW / 2);
    const v = p.overall == null ? null : Math.max(minY, Math.min(maxY, p.overall));
    const y =
      v == null
        ? null
        : padding.top + innerH - ((v - minY) / (maxY - minY)) * innerH;
    return { x, y, point: p };
  });

  const linePath = xy
    .filter((q) => q.y != null)
    .map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x},${q.y}`)
    .join(' ');

  const yTicks = [1, 2, 3, 4, 5];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[140px]">
      {yTicks.map((t) => {
        const y = padding.top + innerH - ((t - minY) / (maxY - minY)) * innerH;
        return (
          <g key={t}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text
              x={padding.left - 4}
              y={y + 3}
              textAnchor="end"
              className="fill-text-light"
              style={{ fontSize: '9px' }}
            >
              {t}
            </text>
          </g>
        );
      })}
      {linePath && (
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" />
      )}
      {xy.map((q, i) => {
        if (q.y == null) return null;
        const selected = selectedBuckets.includes(q.point.bucketStart);
        return (
          <g
            key={i}
            onClick={clickable ? () => onPointClick(q.point.bucketStart) : undefined}
            style={clickable ? { cursor: 'pointer' } : undefined}
          >
            {clickable && (
              <circle cx={q.x} cy={q.y} r="12" fill="transparent" />
            )}
            <circle
              cx={q.x}
              cy={q.y}
              r={selected ? 6 : 3.5}
              fill="#6366f1"
              stroke={selected ? '#ffffff' : 'none'}
              strokeWidth={selected ? 2.5 : 0}
            />
            {selected && (
              <circle
                cx={q.x}
                cy={q.y}
                r={9}
                fill="none"
                stroke="#6366f1"
                strokeWidth={1.5}
                opacity={0.5}
              />
            )}
            <title>
              {formatBucketLabel(q.point.bucketStart, bucket)}: {q.point.overall?.toFixed(1)} ({q.point.evaluationCount} eval
              {q.point.evaluationCount === 1 ? '' : 's'})
              {clickable ? ' — click to drill down' : ''}
            </title>
          </g>
        );
      })}
      {xy.map((q, i) => {
        if (n <= 1) return null;
        if (i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null;
        return (
          <text
            key={`lbl-${i}`}
            x={q.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-text-light"
            style={{ fontSize: '9px' }}
          >
            {formatBucketLabel(q.point.bucketStart, bucket)}
          </text>
        );
      })}
    </svg>
  );
}
