import { useMemo } from 'react';
import { domainColor } from '../../../lib/taxonomy';
import { utilColor } from '../../../lib/statusUtils';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS, WORK_TYPE_LABELS } from '../../../lib/constants';
import { currentMonth, formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import StackedPlanBar from '../StackedPlanBar';
import Tip, { TipRow } from '../Tip';
import InfoDot from '../../../components/ui/InfoDot';

/**
 * One domain's (or, with domain = null, everyone's) capacity summary. The bar
 * reads like the capacity-table rows below: soft track with a tick = average planned
 * FTE, stacked fill = the average FTE actually logged per completed month
 * (green client / violet internal / slate absences). The scale is FIXED at
 * the group's capacity — full width is exactly 100% — and hovering the bar
 * shows the numbers behind it.
 */
export default function DomainCard({ domain, months, includePotential, teamId, actuals }) {
  const { resources } = useData();
  const { rURealised, rU } = useComputed();

  const { count, utilPct, usedFte, totalFte, actSegments, actPct, typedAvg, workedAvgFte } = useMemo(() => {
    const scoped = teamId ? resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)) : resources;
    const domResources = domain ? scoped.filter((r) => r.roles?.some((rl) => rl.domain === domain)) : scoped;
    const count = domResources.length;
    const rUsed = includePotential ? rU : rURealised;
    let used = 0, total = 0;
    for (const r of domResources) {
      for (const m of months) {
        total += r.capacity;
        used += rUsed[r.id]?.[m] || 0;
      }
    }
    // Average per month
    const avgUsed = months.length > 0 ? used / months.length : 0;
    const avgTotal = months.length > 0 ? total / months.length : 0;

    // Logged hours by work type, averaged over the COMPLETED months of the
    // window (the in-progress month would drag the average down) — as FTE so
    // the stack shares the bar's scale.
    const cur = currentMonth();
    const typed = { client: 0, internal: 0, absence: 0 };
    let elapsed = 0;
    for (const m of months) {
      if (m >= cur) continue;
      elapsed++;
      for (const r of domResources) {
        const t = actuals?.byResourceType?.[r.id]?.[m];
        if (!t) continue;
        typed.client += t.client || 0;
        typed.internal += t.internal || 0;
        typed.absence += t.absence || 0;
      }
    }
    const toAvgFte = (h) => (elapsed > 0 ? h / elapsed / MONTHLY_HOURS_PER_FTE : 0);
    const typedAvg = {
      client: toAvgFte(typed.client),
      internal: toAvgFte(typed.internal),
      absence: toAvgFte(typed.absence),
    };
    const workedAvgFte = typedAvg.client + typedAvg.internal;
    const hasAct = typed.client + typed.internal + typed.absence > 0.05;
    return {
      count,
      utilPct: avgTotal > 0 ? Math.round((avgUsed / avgTotal) * 100) : 0,
      usedFte: avgUsed,
      totalFte: avgTotal,
      typedAvg,
      workedAvgFte,
      actSegments: hasAct
        ? [
            { value: typedAvg.client, color: WORK_TYPE_COLORS.client },
            { value: typedAvg.internal, color: WORK_TYPE_COLORS.internal },
            { value: typedAvg.absence, color: WORK_TYPE_COLORS.absence },
          ]
        : [],
      actPct: hasAct && avgTotal > 0 ? Math.round((workedAvgFte / avgTotal) * 100) : null,
    };
  }, [resources, rURealised, rU, domain, months, includePotential, teamId, actuals]);

  const color = utilColor(utilPct);
  const accent = domain ? domainColor(domain) : '#4CBAD4';
  const label = includePotential ? 'all' : 'realised';
  const name = domain || 'Everyone';
  const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);

  const hasAct = actSegments.length > 0;
  const tip = (
    <>
      <b className="text-[11px]">{name} · {formatMonth(months[0])} – {formatMonth(months[months.length - 1])}</b>
      <TipRow label="Capacity" value={`${fmt(totalFte)} FTE = 100%`} />
      <TipRow swatch={accent} label="Planned" value={`${fmt(usedFte)} FTE (${utilPct}%)`} />
      {hasAct && (
        <>
          <TipRow swatch="#34C98E" label="Actual" value={`${fmt(workedAvgFte)} FTE (${actPct}%)`} />
          {['client', 'internal', 'absence'].map((k) => (
            typedAvg[k] > 0.04 && (
              <div key={k} className="pl-3">
                <TipRow swatch={WORK_TYPE_COLORS[k]} label={WORK_TYPE_LABELS[k]}
                  value={`${fmt(typedAvg[k])} FTE${k === 'absence' ? ' · not counted' : ''}`} />
              </div>
            )
          ))}
        </>
      )}
      <div className="opacity-80 mt-0.5">
        avg per month{hasAct ? ' · actuals over completed months' : ''}
      </div>
    </>
  );

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: accent }} />
          <span className="text-[13px] font-bold text-text">{name}</span>
          <InfoDot text={`${domain ? 'Average utilization of this domain’s people' : 'Average utilization of everyone in scope'} over the selected months: mean used FTE ÷ mean capacity per month. “Used” is realised allocation, or all planned with Include potential on. The bar reads like the capacity table below — soft track with a tick = the plan, stacked fill = logged hours by type (green client, violet internal, slate absences), averaged over completed months. Full bar width = the group’s capacity (100%); hover the bar for the numbers. The number on the right is the headcount.`} />
        </div>
        <span className="text-xs font-mono text-text-mid">{count}</span>
      </div>
      <Tip content={tip} className="block cursor-default">
        <StackedPlanBar plan={usedFte} segments={actSegments} max={totalFte} accent={accent} className="mb-1.5" />
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-text-light">{usedFte.toFixed(1)} / {totalFte.toFixed(1)} FTE ({label})</span>
          <span className="text-xs font-bold font-mono" style={{ color }}>
            {utilPct}%
            {actPct != null && <span className="text-[9px] font-semibold text-text-light"> · act {actPct}%</span>}
          </span>
        </div>
      </Tip>
    </div>
  );
}
