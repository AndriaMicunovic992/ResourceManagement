import LineChart from '../../../../components/ui/LineChart';

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

  const data = points.map((p) => ({
    label: formatBucketLabel(p.bucketStart, bucket),
    value: p.overall == null ? null : p.overall,
    sub: p.overall == null ? null : `${p.evaluationCount} eval${p.evaluationCount === 1 ? '' : 's'}`,
  }));

  const selectedIndices = points
    .map((p, i) => (selectedBuckets.includes(p.bucketStart) ? i : -1))
    .filter((i) => i >= 0);

  return (
    <LineChart
      data={data}
      height={150}
      color="#6366f1"
      domain={[1, 5]}
      yTicks={[1, 2, 3, 4, 5]}
      seriesName="Overall"
      valueFormat={(v) => v.toFixed(1)}
      selectable={typeof onPointClick === 'function'}
      selectedIndices={selectedIndices}
      onPointClick={onPointClick ? (i) => onPointClick(points[i].bucketStart) : undefined}
    />
  );
}
