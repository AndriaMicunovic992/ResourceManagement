import { memo } from 'react';
import BulletCell from '../BulletCell';
import { TipRow } from '../Tip';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS, WORK_TYPE_LABELS } from '../../../lib/constants';
import { availableHours, absenceHours, verdictWord } from '../../../lib/availability';
import { planTickColor } from '../../../lib/statusUtils';

// Hours, compact: one decimal under 10h, whole above ("8.5h", "174h").
const fmtH = (h) => `${h >= 9.95 ? Math.round(h) : Math.round(h * 10) / 10}h`;

/**
 * One person × month cell: utilization as a bullet. `plan` is realised
 * allocation as % of capacity (track + tick, red when over 100%), `extra` is
 * additional potential allocation (faint track extension, only when the
 * potential toggle is on), `act` is logged utilization % under the current
 * work-type lens, stacked by `actSegments` (client/internal/absences).
 *
 * Judgments are absence-adjusted: the Δ and its verdict compare worked hours
 * to *expected* hours — the plan capped at the hours left after absences
 * (absence eats slack first, so a leave that fits into free capacity doesn't
 * move the expectation at all). Displayed percentages stay capacity-based so
 * they always match the bar geometry; the tooltip spells out the expected
 * hours whenever the absence actually bites into the plan.
 *
 * For months ahead, `plannedOffDays`/`plannedAvailPct` carry the days off
 * entered in the planner: the tick also turns red when the plan exceeds what
 * the leave leaves available, and the tooltip shows the reduced expectation.
 */
function ResourceUtilCell({ title, plan, extra, act, actSegments, typedHours, capacity = 1, workTypeFilter = 'work', plannedOffDays = 0, plannedAvailPct = null, max, accent, actualPartial }) {
  const hasAct = act != null;
  const overbooked = plan > 100.001 || (plannedAvailPct != null && plan > plannedAvailPct + 0.001);

  const pct = (v) => `${Math.round(v)}%`;
  const toHours = (utilPct) => (utilPct / 100) * capacity * MONTHLY_HOURS_PER_FTE;
  // The workable part of the booking: planned leave clips the plan line to
  // capacity − days off. The clipped remainder renders as a slate hatch up to
  // the (red) tick, so the overextension stays visible while the plan line
  // matches what the person can actually deliver.
  const planWorkable = plannedAvailPct != null ? Math.max(0, Math.min(plan, plannedAvailPct)) : plan;
  const planOff = plan - planWorkable;
  const labelAct = hasAct && (act > 0 || plan > 0) ? `${Math.round(act)}` : null;
  const labelPlan = plan > 0 ? pct(planWorkable) : null;

  const planHours = toHours(plan);
  const actHours = hasAct ? toHours(act) : 0;
  const absH = hasAct ? absenceHours(typedHours) : 0;
  const availH = hasAct ? availableHours(typedHours, capacity) : toHours(100);
  // What the plan can actually deliver this month: absences eat slack first,
  // so the expectation only drops once the hours left fall below the plan.
  const expectedHours = Math.min(planHours, availH);

  // Δ in hours against the absence-adjusted expectation.
  let delta = null;
  if (hasAct && !actualPartial && plan > 0 && act > 0) {
    const base = expectedHours > 1 ? expectedHours : planHours;
    const d = actHours - base;
    const word = verdictWord(actHours, base);
    delta = `${d >= 0 ? '+' : '−'}${fmtH(Math.abs(d))}${word ? ` · ${word}` : ''}`;
  }

  // Which work types the current lens counts toward "Actual".
  const inLens = (k) => (workTypeFilter === 'work' ? k !== 'absence' : k === workTypeFilter);
  const typeRows = hasAct && typedHours
    ? ['client', 'internal', 'absence'].filter((k) => (typedHours[k] || 0) > 0)
    : [];

  // Only when the absence actually bites into the plan (not just the slack).
  const showExpected = hasAct && plan > 0 && absH > 0.05 && expectedHours < planHours - 0.5;
  // Forward-looking months (incl. the one in progress): planned days off
  // shrink the deliverable plan.
  const showPlannedOff = plannedOffDays > 0 && (!hasAct || actualPartial);

  const tip = (plan > 0 || extra > 0 || (hasAct && act > 0) || showPlannedOff) ? (
    <>
      <b className="text-[11px]">{title}</b>
      {plan > 0 && <TipRow swatch={planTickColor(accent, { alert: overbooked })} label="Planned" value={`${fmtH(planHours)} (${pct(plan)})`} />}
      {showExpected && (
        <TipRow label="Expected" value={`${fmtH(expectedHours)} · after ${fmtH(absH)} absence`} />
      )}
      {showPlannedOff && (
        <TipRow swatch="#94A3B8" label="Days off"
          value={`${plannedOffDays}d planned${plan > 0 && planOff > 0.001 ? ` · workable ${fmtH(toHours(planWorkable))}` : ''}`} />
      )}
      {extra > 0 && <TipRow label="+ potential" value={`${fmtH(toHours(extra))} (${pct(extra)})`} />}
      {hasAct && (act > 0 || plan > 0) && (
        <TipRow swatch="#34C98E" label="Actual"
          value={`${fmtH(actHours)} (${pct(act)})${actualPartial ? ' so far' : ''}`} />
      )}
      {typeRows.map((k) => (
        <div key={k} className="pl-3">
          <TipRow swatch={WORK_TYPE_COLORS[k]} label={WORK_TYPE_LABELS[k]}
            value={`${fmtH(typedHours[k] || 0)}${inLens(k) ? '' : ' · not counted'}`} />
        </div>
      ))}
      {delta && <TipRow label="Δ" value={delta} />}
      {actualPartial && <div className="opacity-80">month in progress</div>}
      {hasAct && act > 0 && plan <= 0 && <div className="opacity-80">unplanned work</div>}
      {overbooked && (
        <div className="text-[#FBA9B1]">
          {plan > 100.001 ? 'over capacity' : `over available capacity — ${plannedOffDays}d off`}
        </div>
      )}
    </>
  ) : null;

  return (
    <BulletCell
      plan={planWorkable}
      planOff={planOff}
      act={hasAct ? act : null}
      actSegments={actSegments}
      extra={extra}
      max={max}
      accent={accent}
      alert={overbooked}
      inProgress={hasAct && actualPartial}
      labelAct={labelAct}
      labelPlan={labelPlan}
      tip={tip}
    />
  );
}

export default memo(ResourceUtilCell);
