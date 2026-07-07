/**
 * One-line legend for the "act" layer on the Insights heatmaps: what the value
 * is and what the traffic-light colors mean relative to the plan.
 */
export default function ActualsLegend() {
  return (
    <span className="ml-2 text-[9.5px] font-normal text-text-light whitespace-nowrap">
      act = logged Tempo hours ·{' '}
      <span className="font-semibold" style={{ color: '#5BC68A' }}>on plan</span>{' / '}
      <span className="font-semibold" style={{ color: '#F5A623' }}>under</span>{' / '}
      <span className="font-semibold" style={{ color: '#E8636F' }}>over</span>{' · '}
      <span className="font-semibold" style={{ color: '#9CA3AF' }}>grey</span> = month in progress
    </span>
  );
}
