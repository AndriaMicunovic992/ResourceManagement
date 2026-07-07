import { memo } from 'react';
import BulletCell from '../BulletCell';
import { TipRow } from '../Tip';

/**
 * One person × month cell: utilization as a bullet. `plan` is realised
 * allocation as % of capacity (track + tick, red when over 100%), `extra` is
 * additional potential allocation (faint track extension, only when the
 * potential toggle is on), `act` is logged utilization %. The row `max` is
 * anchored at 100% so everyone's capacity renders at the same width.
 */
function ResourceUtilCell({ title, plan, extra, act, max, accent, actualPartial }) {
  const hasAct = act != null;
  const overbooked = plan > 100.001;

  const pct = (v) => `${Math.round(v)}%`;
  const labelAct = hasAct && (act > 0 || plan > 0) ? `${Math.round(act)}` : null;
  const labelPlan = plan > 0 ? pct(plan) : null;

  let delta = null;
  if (hasAct && !actualPartial && plan > 0 && act > 0) {
    const d = Math.round((act / plan - 1) * 100);
    const word = Math.abs(d) <= 15 ? 'on plan' : d < 0 ? 'under plan' : 'over plan';
    delta = `${d >= 0 ? '+' : ''}${d}% · ${word}`;
  }

  const tip = (plan > 0 || extra > 0 || (hasAct && act > 0)) ? (
    <>
      <b className="text-[11px]">{title}</b>
      {plan > 0 && <TipRow swatch={accent} label="Planned" value={pct(plan)} />}
      {extra > 0 && <TipRow label="+ potential" value={pct(extra)} />}
      {hasAct && (act > 0 || plan > 0) && (
        <TipRow swatch="#34C98E" label="Actual" value={`${pct(act)}${actualPartial ? ' so far' : ''}`} />
      )}
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
