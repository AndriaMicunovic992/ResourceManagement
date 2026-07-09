import Tip from './Tip';
import { planTickColor } from '../../lib/statusUtils';

/**
 * One month cell of the plan-vs-actual heatmaps: a bullet — soft track sized
 * to the planned value with a tick at the plan target, the actual as a solid
 * fill on top — plus a small "act/plan" value label underneath. Widths are
 * fractions of the row's own `max`, so bar lengths compare within a row;
 * absolute values live in the label and the tooltip.
 *
 *  plan        planned magnitude this month (FTE or % of capacity)
 *  planOff     part of the booking that falls into planned leave: rendered as
 *              a slate hatch continuing the track, with the tick at the FULL
 *              booking (plan + planOff) — so an overextended plan stays
 *              visible while the workable plan line shrinks
 *  act         actual magnitude; null = no actual layer for this cell
 *  actSegments stacked breakdown of `act` as [{ value, color }] (e.g. client
 *              vs internal hours) — falls back to a single fill when absent;
 *              ignored while the month is in progress (grey fill)
 *  extra       faint track extension beyond plan (potential allocation)
 *  max         row scale (>= every plan/act in the row)
 *  accent      track/tick hue (customer accent or domain color)
 *  alert       plan itself needs attention → the tick turns red
 *              (client: understaffed vs need; people: over capacity)
 *  inProgress  current month → grey fill, muted label
 *  muted       potential-only row → grey track/tick
 *  labelAct / labelPlan   preformatted label parts; either may be null
 *  tip         tooltip node (null = no tooltip)
 */
export default function BulletCell({
  plan = 0,
  planOff = 0,
  act = null,
  actSegments = null,
  extra = 0,
  max = 1,
  accent = '#6366f1',
  alert = false,
  inProgress = false,
  muted = false,
  labelAct = null,
  labelPlan = null,
  tip = null,
}) {
  const USABLE = 72; // px of bullet space inside the 82px column
  const scale = Math.max(max, 0.0001);
  const w = (v) => Math.min(USABLE, Math.max(0, (v / scale) * USABLE));
  const hasPlan = plan > 0.0001;
  // The full booking incl. the part clipped by planned leave — tick anchor.
  const hasBooking = plan + planOff > 0.0001;
  const hasAct = act != null && act > 0.0001;
  const showActLayer = act != null;
  const empty = !hasBooking && !hasAct && extra <= 0;

  if (empty) {
    return (
      <Tip content={tip} className="w-[82px] shrink-0 flex items-center justify-center h-[44px]">
        <span className="text-[13px] font-mono text-text-light">—</span>
      </Tip>
    );
  }

  const trackColor = muted ? '#E5E7EB' : `color-mix(in srgb, ${accent} 16%, white)`;
  const tickColor = planTickColor(accent, { alert, muted });
  const fillBg = inProgress
    ? '#CBD8E2'
    : hasBooking
      ? 'linear-gradient(100deg, #34C98E, color-mix(in srgb, #34C98E 78%, white))'
      : 'linear-gradient(100deg, #F5A623, color-mix(in srgb, #F5A623 78%, white))'; // unplanned work
  const fillShadow = inProgress ? 'none' : hasBooking ? '0 3px 7px -2px #34C98E80' : '0 3px 7px -2px #F5A62380';

  return (
    <Tip content={tip} className="w-[82px] shrink-0 h-[44px] flex flex-col items-stretch justify-center">
      <div className="relative h-[24px]">
        {/* plan track (+ faint potential extension) */}
        {hasPlan && (
          <span className="absolute rounded-md" style={{ left: 5, top: 4, height: 16, width: w(plan), background: trackColor }} />
        )}
        {/* the booked-but-on-leave remainder: slate hatch up to the tick */}
        {planOff > 0.0001 && (
          <span className="absolute rounded-md" style={{
            left: 5 + w(plan), top: 4, height: 16,
            width: Math.max(2, w(plan + planOff) - w(plan)),
            background: 'repeating-linear-gradient(45deg, rgba(148,163,184,0.4) 0 3px, rgba(148,163,184,0.12) 3px 6px)',
          }} />
        )}
        {extra > 0 && (
          <span className="absolute rounded-md" style={{ left: 5 + w(plan + planOff), top: 7, height: 10, width: Math.max(0, w(plan + planOff + extra) - w(plan + planOff)), background: '#EDF1F5' }} />
        )}
        {/* "no plan" baseline under unplanned work */}
        {!hasBooking && (
          <span className="absolute" style={{ left: 6, right: 6, top: 11, height: 2, background: 'repeating-linear-gradient(90deg,#E4EDF2 0 6px,transparent 6px 11px)' }} />
        )}
        {/* actual fill — stacked segments when a breakdown is given */}
        {hasAct && !inProgress && actSegments && actSegments.length > 0 ? (
          (() => {
            const segs = actSegments.filter((s) => s.value > 0.0001);
            let acc = 0;
            return segs.map((s, i) => {
              const gap = i > 0 ? 1 : 0; // half of the 2px surface gap per side
              const left = 5 + w(acc) + gap;
              const width = Math.max(2, w(acc + s.value) - w(acc) - gap);
              acc += s.value;
              const rl = i === 0 ? 4 : 1;
              const rr = i === segs.length - 1 ? 4 : 1;
              return (
                <span key={i} className="absolute" style={{
                  left, top: 8, height: 8, width,
                  borderRadius: `${rl}px ${rr}px ${rr}px ${rl}px`,
                  background: `linear-gradient(100deg, ${s.color}, color-mix(in srgb, ${s.color} 78%, white))`,
                  boxShadow: `0 3px 7px -2px ${s.color}80`,
                }} />
              );
            });
          })()
        ) : hasAct ? (
          <span className="absolute rounded" style={{ left: 5, top: 8, height: 8, width: Math.max(3, w(act)), background: fillBg, boxShadow: fillShadow }} />
        ) : null}
        {/* plan tick — at the full booking, past any on-leave hatch */}
        {hasBooking && (
          <span className="absolute rounded-sm" style={{ left: 3.5 + w(plan + planOff), top: 1, width: 3, height: 22, background: tickColor }} />
        )}
      </div>
      {(labelAct || labelPlan) && (
        <div className="text-center text-[11px] font-mono leading-[14px] whitespace-nowrap">
          {labelAct && (
            // An act value with no plan reads amber (unplanned) only when no
            // segment breakdown names the hours — typed segments (internal,
            // absences, per-client) already say what the time was.
            <span className={inProgress ? 'text-text-light' : hasPlan || (actSegments && actSegments.length > 0) ? 'text-text-mid font-semibold' : 'text-[#C98A1B] font-semibold'}>
              {labelAct}
            </span>
          )}
          {labelAct && labelPlan && <span className="text-text-light">/</span>}
          {labelPlan && <span className="text-text-light">{labelPlan}</span>}
        </div>
      )}
    </Tip>
  );
}
