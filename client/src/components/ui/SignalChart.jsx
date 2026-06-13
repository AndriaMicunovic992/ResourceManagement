import LineChart from './LineChart';

// 1-5 satisfaction dot color, kept from the original chart.
function ratingColor(v) {
  return v >= 4 ? '#5BC68A' : v >= 3 ? '#F5A623' : '#E8636F';
}

/**
 * Monthly 1-5 satisfaction line with a dashed trend line, rendered in the
 * shared dashboard chart treatment. points: [{ label, value }] in
 * chronological order (value may be null for months without a rating).
 */
export default function SignalChart({ points, height = 120 }) {
  const hasAny = (points || []).some((p) => p.value != null);
  if (!hasAny) {
    return <div className="text-xs text-text-light">No ratings yet.</div>;
  }
  return (
    <LineChart
      data={points}
      height={height}
      color="#4CBAD4"
      domain={[1, 5]}
      yTicks={[1, 3, 5]}
      seriesName="Satisfaction"
      valueFormat={(v) => v.toFixed(1)}
      pointColor={ratingColor}
      trendLine
    />
  );
}
