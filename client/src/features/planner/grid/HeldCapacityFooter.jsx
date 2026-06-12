import { CW } from '../../../lib/constants';
import { useData } from '../../../contexts/DataContext';

/**
 * Sticky footer while a resource is held: their remaining free capacity per
 * period across ALL projects, so the planner sees the impact of a placement
 * before clicking. Red = already over capacity.
 */
export default function HeldCapacityFooter({ resource, periods }) {
  const { assignments } = useData();
  const own = assignments.filter((a) => a.resourceId === resource.id);
  const loadFor = (m) =>
    own.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
  const capacity = resource.capacity ?? 1;

  return (
    <div className="flex sticky bottom-0 z-10 border-t-2 border-primary bg-white relative">
      <div className="absolute -top-2.5 left-2 z-10 px-1.5 py-0.5 rounded bg-primary text-white text-[9px] font-bold whitespace-nowrap">
        {resource.name} — free capacity
      </div>
      {periods.map((p) => {
        const avgLoad =
          p.months.reduce((s, m) => s + loadFor(m), 0) / p.months.length;
        const free = capacity - avgLoad;
        const over = free < -0.001;
        const cls = over
          ? 'text-danger'
          : free <= 0.05
            ? 'text-text-light'
            : 'text-success';
        return (
          <div
            key={p.label}
            className="shrink-0 flex items-center justify-center border-r border-border-light"
            style={{ width: p.months.length * CW, height: 30 }}
          >
            <span className={`font-mono text-[10px] font-bold ${cls}`}>
              {over ? free.toFixed(1) : `+${free.toFixed(1)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
