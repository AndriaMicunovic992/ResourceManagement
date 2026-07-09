import { useMemo } from 'react';
import ResourceHeatmapRow from './ResourceHeatmapRow';
import BulletCell from '../BulletCell';
import { TipRow } from '../Tip';
import { formatMonth, currentMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS, WORK_TYPE_LABELS } from '../../../lib/constants';
import { hoursForFilter, segmentsForFilter, stackTotalForFilter, typesForFilter } from '../workTypeLens';
import InfoDot from '../../../components/ui/InfoDot';
import ActualsLegend from '../ActualsLegend';

// Totals-row accent: a neutral slate so the footer reads as an aggregate of
// the rows above, not as another person.
const FOOTER_ACCENT = '#64748B';

export default function ResourceHeatmap({ months, onResourceClick, includePotential, teamId, actuals, workTypeFilter = 'work' }) {
  const { resources } = useData();
  const { rURealised, rU } = useComputed();

  const visibleResources = useMemo(
    () => (teamId ? resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)) : resources),
    [resources, teamId]
  );

  const cur = currentMonth();
  const showActuals = !!actuals?.hasActuals;

  // Totals: average utilization per month across visible resources
  const totals = useMemo(() => {
    const result = {};
    const rUsed = includePotential ? rU : rURealised;
    for (const m of months) {
      let totalUsed = 0, totalCap = 0;
      for (const r of visibleResources) {
        totalCap += r.capacity;
        totalUsed += rUsed[r.id]?.[m] || 0;
      }
      result[m] = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0;
    }
    return result;
  }, [visibleResources, months, rURealised, rU, includePotential]);

  // Matched people's logged hours per elapsed month, summed by work type —
  // the totals-row equivalent of each row's typedHours. Matched people
  // (linked to a Jira account) over matched capacity only, so untracked
  // people don't dilute it. Same convention as the home dashboard.
  const actualTotals = useMemo(() => {
    if (!showActuals) return null;
    const byType = actuals?.byResourceType || {};
    const matched = visibleResources.filter((r) => r.externalWorkId);
    const matchedCap = matched.reduce((s, r) => s + (r.capacity || 1), 0);
    if (matchedCap <= 0) return null;
    const types = {};
    for (const m of months) {
      if (m > cur) continue;
      const t = { client: 0, internal: 0, absence: 0 };
      for (const r of matched) {
        const h = byType[r.id]?.[m];
        if (!h) continue;
        t.client += h.client || 0;
        t.internal += h.internal || 0;
        t.absence += h.absence || 0;
      }
      types[m] = t;
    }
    return { types, matchedCap, matchedCount: matched.length };
  }, [showActuals, actuals, visibleResources, months, cur]);
  const hasActualTotals = !!actualTotals;

  // Summed hours → % of matched capacity.
  const totalPct = (h) => ((h / MONTHLY_HOURS_PER_FTE) / (actualTotals?.matchedCap || 1)) * 100;

  // Footer scale: anchored at 100% capacity like the rows above; only an
  // overbooked average or a heavy logged stack stretches it further.
  const footerMax = useMemo(() => {
    let max = 100;
    for (const m of months) {
      max = Math.max(max, totals[m] || 0);
      const t = actualTotals?.types?.[m];
      if (t) max = Math.max(max, totalPct(stackTotalForFilter(t, workTypeFilter)));
    }
    return max;
  }, [months, totals, actualTotals, workTypeFilter]);

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card overflow-auto">
      <h3 className="text-[13px] font-bold text-text px-5 pt-4 pb-2">
        Capacity Heatmap{' '}
        <InfoDot text="Each month is a small bullet: the soft track is the person’s realised allocation as % of capacity with a tick at its target (red when over what they can deliver), the solid bar is the time they actually logged in Tempo — stacked by work type (green = client, violet = internal, slate = absences). Absences render in the stack so time off is visible where it explains a plan shortfall, but the “act” number counts worked time only. The tooltip’s Δ and verdict compare worked hours to the expected hours — the plan capped at the hours left after absences (a leave that fits into free capacity doesn’t lower the bar) — so vacation never reads as underdelivery. For months ahead, planned days off clip the plan line to what’s left of the month: the track is the workable part (also the % label), the slate hatch is the booking that falls into the leave, and the red tick marks the full booking that needs re-staffing. The Hours filter switches the lens to one work type or absences alone. Click a row to break the person’s hours down per client, internal work and absences; those rows drill two levels further — the Jira epics behind the hours, then the individual issues (actual hours only; no plan exists at that depth). Click a name to open the profile. Rows share a scale anchored at 100% capacity; people without synced hours get no actual layer. A grey bar is the current month, still being logged." />
        <ActualsLegend showAct={showActuals} types={showActuals ? typesForFilter(workTypeFilter) : null} />
      </h3>
      <div className="flex items-center border-b-2 border-border sticky top-0 bg-white z-10">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-semibold text-text-mid">Name</span>
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 text-center text-[10px] font-mono font-bold text-primary py-2">
            <span className={m === cur ? 'bg-primary-light rounded-md px-1.5 py-0.5' : ''}>{formatMonth(m)}</span>
          </div>
        ))}
      </div>
      {visibleResources.map((r) => (
        <ResourceHeatmapRow key={r.id} resource={r} months={months}
          onOpen={() => onResourceClick(r)} includePotential={includePotential}
          typedHours={showActuals ? actuals?.byResourceType?.[r.id] : null}
          workTypeFilter={workTypeFilter}
          window={actuals?.window} />
      ))}
      {/* Totals row — same bullet language as the rows above */}
      <div className="flex items-center border-t-2 border-border bg-[#F7FAFC] sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-bold text-text">Avg Utilization</span>
          {hasActualTotals && <span className="block text-[9px] font-semibold text-text-light">plan / act (matched people)</span>}
        </div>
        {months.map((m) => {
          const pct = totals[m] || 0;
          const t = actualTotals?.types?.[m] || null;
          const actPct = t ? totalPct(hoursForFilter(t, workTypeFilter)) : null;
          const partial = m === cur;
          const segs = t && !partial
            ? segmentsForFilter(t, workTypeFilter).map((s) => ({ ...s, value: totalPct(s.value) }))
            : null;
          const inLens = (k) => (workTypeFilter === 'work' ? k !== 'absence' : k === workTypeFilter);
          const typeRows = t ? ['client', 'internal', 'absence'].filter((k) => (t[k] || 0) > 0) : [];
          const overbooked = pct > 100.001;
          const tip = (pct > 0 || (actPct != null && actPct > 0)) ? (
            <>
              <b className="text-[11px]">Avg utilization · {formatMonth(m)}</b>
              {pct > 0 && (
                <TipRow swatch={FOOTER_ACCENT} label="Planned"
                  value={`${Math.round(pct)}% avg of ${visibleResources.length} people`} />
              )}
              {actPct != null && (
                <TipRow swatch="#34C98E" label="Actual"
                  value={`${Math.round(actPct)}%${partial ? ' so far' : ''} · ${actualTotals.matchedCount} matched`} />
              )}
              {typeRows.map((k) => (
                <div key={k} className="pl-3">
                  <TipRow swatch={WORK_TYPE_COLORS[k]} label={WORK_TYPE_LABELS[k]}
                    value={`${Math.round(t[k])}h${inLens(k) ? '' : ' · not counted'}`} />
                </div>
              ))}
              {partial && t && <div className="opacity-80">month in progress</div>}
              {overbooked && <div className="text-[#FBA9B1]">over capacity</div>}
            </>
          ) : null;
          return (
            <BulletCell key={m}
              plan={pct}
              act={actPct}
              actSegments={segs}
              max={footerMax}
              accent={FOOTER_ACCENT}
              alert={overbooked}
              inProgress={actPct != null && partial}
              labelAct={actPct != null && (actPct > 0 || pct > 0) ? `${Math.round(actPct)}` : null}
              labelPlan={pct > 0 ? `${Math.round(pct)}%` : null}
              tip={tip}
            />
          );
        })}
      </div>
    </div>
  );
}
