/**
 * Tiny SVG line chart for 1-5 ratings over months, with a dashed linear trend
 * line. points: [{ label, value }] in chronological order (value may be null
 * for months without a rating — they keep their x slot but aren't drawn).
 */
export default function SignalChart({ points, height = 96 }) {
  const valid = points
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.value != null);
  if (valid.length === 0) {
    return <div className="text-xs text-text-light">No ratings yet.</div>;
  }

  const colW = 34;
  const padX = 14;
  const padTop = 8;
  const padBottom = 18;
  const w = padX * 2 + Math.max(points.length - 1, 1) * colW;
  const plotH = height - padTop - padBottom;
  const x = (i) => padX + i * colW;
  const y = (v) => padTop + ((5 - v) / 4) * plotH;

  // Least-squares trend over the rated points.
  let trend = null;
  if (valid.length >= 2) {
    const n = valid.length;
    const sx = valid.reduce((s, p) => s + p.i, 0);
    const sy = valid.reduce((s, p) => s + p.value, 0);
    const sxx = valid.reduce((s, p) => s + p.i * p.i, 0);
    const sxy = valid.reduce((s, p) => s + p.i * p.value, 0);
    const denom = n * sxx - sx * sx;
    if (denom !== 0) {
      const slope = (n * sxy - sx * sy) / denom;
      const intercept = (sy - slope * sx) / n;
      const clamp = (v) => Math.max(1, Math.min(5, v));
      const i0 = valid[0].i;
      const i1 = valid[valid.length - 1].i;
      trend = {
        x1: x(i0),
        y1: y(clamp(slope * i0 + intercept)),
        x2: x(i1),
        y2: y(clamp(slope * i1 + intercept)),
      };
    }
  }

  const line = valid.map((p) => `${x(p.i)},${y(p.value)}`).join(' ');
  const color = (v) => (v >= 4 ? '#5BC68A' : v === 3 ? '#F5A623' : '#E8636F');

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      style={{ maxHeight: height }}
      preserveAspectRatio="xMinYMid meet"
    >
      {/* guides at 1/3/5 */}
      {[1, 3, 5].map((v) => (
        <line
          key={v}
          x1={padX - 6}
          x2={w - padX + 6}
          y1={y(v)}
          y2={y(v)}
          stroke="#E8F0F5"
          strokeWidth="1"
        />
      ))}
      {trend && (
        <line
          x1={trend.x1}
          y1={trend.y1}
          x2={trend.x2}
          y2={trend.y2}
          stroke="#6B8A9E"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.7"
        />
      )}
      {valid.length > 1 && (
        <polyline points={line} fill="none" stroke="#4CBAD4" strokeWidth="2" />
      )}
      {valid.map((p) => (
        <g key={p.i}>
          <circle cx={x(p.i)} cy={y(p.value)} r="3.5" fill={color(p.value)} />
          <text
            x={x(p.i)}
            y={y(p.value) - 7}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="#2C3E50"
          >
            {p.value}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <text
          key={i}
          x={x(i)}
          y={height - 4}
          textAnchor="middle"
          fontSize="8"
          fill="#A0BCC9"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
