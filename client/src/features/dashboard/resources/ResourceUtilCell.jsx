import { memo } from 'react';
import BulletCell from '../BulletCell';
import { TipRow } from '../Tip';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS, WORK_TYPE_LABELS } from '../../../lib/constants';
import { availableHours, absenceHours, verdictWord } from '../../../lib/availability';

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
 * to *expected* hours — plan × (available ÷ capacity) — so a vacation month
 * doesn't read as underdelivery. Displayed percentages stay capacity-based so
 * they always match the bar geometry; the tooltip spells out available and
 * expected hours whenever absences reduce them.
 */
function ResourceUtilCell({ title, plan, extra, act, actSegments, typedHours, capacity = 1, workTypeFilter = 'work', max, accent, actualPartial }) {
  const hasAct = act != null;
  const overbooked = plan > 100.001;

  const pct = (v) => `${Math.round(v)}%`;
  const toHours = (utilPct) => (utilPct / 100) * capacity * MONTHLY_HOURS_PER_FTE;
  const labelAct = hasAct && (act > 0 || plan > 0) ? `${Math.round(act)}` : null;
  const labelPlan = plan > 0 ? pct(plan) : null;

  const planHours = toHours(plan);
  const actHours = hasAct ? toHours(act) : 0;
  const absH = hasAct ? absenceHours(typedHours) : 0;
  const availH = hasAct ? availableHours(typedHours, capacity) : toHours(100);
  // What the plan can actually deliver this month, given the absences.
  const capH = toHours(100);
  const expectedHours = capH > 0 ? planHours * (availH / capH) : planHours;

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

  const showExpected = hasAct && plan > 0 && absH > 0.05;

  const tip = (plan > 0 || extra > 0 || (hasAct && act > 0)) ? (
    <>
      <b className="text-[11px]">{title}</b>
      {plan > 0 && <TipRow swatch={accent} label="Planned" value={`${fmtH(planHours)} (${pct(plan)})`} />}
      {showExpected && (
        <TipRow label="Expected" value={`${fmtH(expectedHours)} · after ${fmtH(absH)} absence`} />
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
      {overbooked && <div className="text-[#FBA9B1]">over capacity</div>}
    </>
  ) : null;

  return (
    <BulletCell
      plan={plan}
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
