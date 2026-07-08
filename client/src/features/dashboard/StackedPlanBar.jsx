/**
 * The heatmap bullet at card size: a soft plan track with a tick at the plan
 * value, and the logged time stacked on top by work type (green = client,
 * violet = internal, slate = absences). Pass `max` (e.g. the capacity) to FIX
 * the scale — full width then always means exactly that value (100%), and
 * anything beyond clamps at the edge. Without `max` the bar fits plan/stack.
 * Units are the caller's business (hours or FTE); everything just scales.
 */
export default function StackedPlanBar({ plan = 0, segments = [], max = null, accent = '#6366f1', className = '' }) {
  const stack = segments.reduce((s, x) => s + (x.value || 0), 0);
  const scale = max != null ? Math.max(max, 0.0001) : Math.max(plan, stack, 0.0001);
  const pct = (v) => Math.min(100, Math.max(0, (v / scale) * 100));
  const visible = segments.filter((s) => (s.value || 0) > 0.0001);
  let acc = 0;

  return (
    <div className={`relative h-[14px] rounded-md bg-border-light/40 ${className}`}>
      {plan > 0.0001 && (
        <span
          className="absolute rounded-md"
          style={{ left: 0, top: 2, bottom: 2, width: `${pct(plan)}%`, background: `color-mix(in srgb, ${accent} 16%, white)` }}
        />
      )}
      {visible.map((s, i) => {
        const left = pct(acc);
        const width = pct(acc + s.value) - left;
        acc += s.value;
        const rl = i === 0 ? 3 : 1;
        const rr = i === visible.length - 1 ? 3 : 1;
        return (
          <span
            key={i}
            className="absolute"
            style={{
              left: `calc(${left}% + ${i > 0 ? 1 : 0}px)`, top: 4, bottom: 4,
              width: `max(2px, calc(${width}% - ${i > 0 ? 1 : 0}px))`,
              borderRadius: `${rl}px ${rr}px ${rr}px ${rl}px`,
              background: `linear-gradient(100deg, ${s.color}, color-mix(in srgb, ${s.color} 78%, white))`,
            }}
          />
        );
      })}
      {plan > 0.0001 && (
        <span
          className="absolute rounded-sm"
          style={{ left: `calc(${pct(plan)}% - 2px)`, top: 0, bottom: 0, width: 3, background: `color-mix(in srgb, ${accent} 82%, black)` }}
        />
      )}
    </div>
  );
}
