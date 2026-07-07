import { memo } from 'react';
import BulletCell from '../BulletCell';
import { TipRow } from '../Tip';

/**
 * One customer/project × month cell: adapts row staffing data to the shared
 * bullet cell. `plan` is the filled assignment FTE (the track + tick),
 * `needed` only drives the red understaffed tick and the tooltip, `act` is
 * logged Tempo FTE (null = no actual layer for this row/month).
 */
function HeatmapCell({ title, plan, needed, act, max, accent, isPotential, actualPartial }) {
  const hasAct = act != null;
  const understaffed = !isPotential && needed > 0 && plan + 0.001 < needed;

  const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const labelAct = hasAct && (act > 0 || plan > 0) ? fmt(act) : null;
  const labelPlan = plan > 0 ? fmt(plan) : null;

  let delta = null;
  if (hasAct && !actualPartial && plan > 0 && act > 0) {
    const pct = Math.round((act / plan - 1) * 100);
    const word = Math.abs(pct) <= 15 ? 'on plan' : pct < 0 ? 'under plan' : 'over plan';
    delta = `${pct >= 0 ? '+' : ''}${pct}% · ${word}`;
  }

  const tip = (plan > 0 || needed > 0 || (hasAct && act > 0)) ? (
    <>
      <b className="text-[11px]">{title}</b>
      {needed > 0 && <TipRow label="Needed" value={`${fmt(needed)} FTE`} />}
      {plan > 0 ? (
        <TipRow swatch={accent} label="Planned" value={`${fmt(plan)} FTE`} />
      ) : (
        hasAct && act > 0 && <TipRow swatch={accent} label="Planned" value="none" />
      )}
      {hasAct && (act > 0 || plan > 0) && (
        <TipRow swatch="#34C98E" label="Actual" value={`${fmt(act)} FTE${actualPartial ? ' so far' : ''}`} />
      )}
      {delta && <TipRow label="Δ" value={delta} />}
      {actualPartial && <div className="opacity-80">month in progress</div>}
      {hasAct && act > 0 && plan <= 0 && <div className="opacity-80">unplanned work</div>}
      {understaffed && <div className="text-[#FBA9B1]">understaffed: {fmt(needed - plan)} FTE open</div>}
      {isPotential && <div className="opacity-80">potential — not committed</div>}
    </>
  ) : null;

  return (
    <BulletCell
      plan={plan}
      act={hasAct ? act : null}
      max={max}
      accent={accent}
      alert={understaffed}
      inProgress={hasAct && actualPartial}
      muted={isPotential}
      labelAct={labelAct}
      labelPlan={labelPlan}
      tip={tip}
    />
  );
}

// Presentational leaf — memoized (one per customer/project × month).
export default memo(HeatmapCell);
