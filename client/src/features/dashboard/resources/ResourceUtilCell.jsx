import { memo } from 'react';
import BulletCell from '../BulletCell';
import { TipRow } from '../Tip';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS, WORK_TYPE_LABELS } from '../../../lib/constants';

// Hours, compact: one decimal under 10h, whole above ("8.5h", "174h").
const fmtH = (h) => `${h >= 9.95 ? Math.round(h) : Math.round(h * 10) / 10}h`;

/**
 * One person × month cell: utilization as a bullet. `plan` is realised
 * allocation as % of capacity (track + tick, red when over 100%), `extra` is
 * additional potential allocation (faint track extension, only when the
 * potential toggle is on), `act` is logged utilization % under the current
 * work-type lens, stacked by `actSegments` (client/internal). `typedHours`
 * (this month's raw hours per work type) feeds the tooltip breakdown; the
 * tooltip leads with hours and keeps % as context so units never mix mid-list.
 * The row `max` is anchored at 100% so capacity renders the same width everywhere.
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

  // Δ as an hours difference — a ratio explodes into noise ("+1902%") when the
  // plan is tiny. The qualitative word still comes from the ratio when a real
  // plan exists.
  let delta = null;
  if (hasAct && !actualPartial && plan > 0 && act > 0) {
    const d = actHours - planHours;
    const r = Math.round((act / plan - 1) * 100);
    const word = Math.abs(r) <= 15 ? 'on plan' : r < 0 ? 'under plan' : 'over plan';
    delta = `${d >= 0 ? '+' : '−'}${fmtH(Math.abs(d))} · ${word}`;
  }

  // Which work types the current lens counts toward "Actual".
  const inLens = (k) => (workTypeFilter === 'work' ? k !== 'absence' : k === workTypeFilter);
  const typeRows = hasAct && typedHours
    ? ['client', 'internal', 'absence'].filter((k) => (typedHours[k] || 0) > 0)
    : [];

  const tip = (plan > 0 || extra > 0 || (hasAct && act > 0)) ? (
    <>
      <b className="text-[11px]">{title}</b>
      {plan > 0 && <TipRow swatch={accent} label="Planned" value={`${fmtH(planHours)} (${pct(plan)})`} />}
      {extra > 0 && <TipRow label="+ potential" value={`${fmtH(toHours(extra))} (${pct(extra)})`} />}
      {hasAct && (act > 0 || plan > 0) && (
        <TipRow swatch="#34C98E" label="Actual"
          value={`${fmtH(actHours)} (${pct(act)})${actualPartial ? ' so far' : ''}`} />
      )}
      {typeRows.map((k) => (
        <div key={k} className="pl-3">
          <TipRow swatch={WORK_TYPE_COLORS[k]} label={WORK_TYPE_LABELS[k]}
            value={`${fmtH(typedHours[k] || 0)}${inLens(k) ? '' : ' · excluded'}`} />
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
