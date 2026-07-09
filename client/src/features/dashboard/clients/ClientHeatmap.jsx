import { useMemo } from 'react';
import ClientHeatmapHeader from './ClientHeatmapHeader';
import CustomerHeatmapRow from './CustomerHeatmapRow';
import HeatmapCell from './HeatmapCell';
import EmptyState from '../../../components/ui/EmptyState';
import InfoDot from '../../../components/ui/InfoDot';
import ActualsLegend from '../ActualsLegend';
import { useData } from '../../../contexts/DataContext';
import { currentMonth, formatMonth } from '../../../lib/dateUtils';
import { hoursToFte } from '../../../lib/constants';

// Totals-row accent: a neutral slate so the footer reads as an aggregate of
// the rows above, not as another customer.
const FOOTER_ACCENT = '#64748B';

export default function ClientHeatmap({ months, includePotential, teamId, actuals }) {
  const { customers, projects, needs, assignments, resources } = useData();
  const filtered = useMemo(() => {
    if (includePotential) return customers;
    return customers.filter((c) => c.status === 'realised');
  }, [customers, includePotential]);

  // When a team is selected, only count filled FTE contributed by that team's
  // people (null = no team filter → count everyone). Without this the tab
  // silently ignored the team selector every other view respects.
  const teamResourceIds = useMemo(
    () => (teamId ? new Set(resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)).map((r) => r.id)) : null),
    [resources, teamId]
  );

  const cur = currentMonth();
  // With a team lens on, actuals?.byCustomer/byProject are already scoped to
  // that team's people (useWindowActuals refetches them with teamId).
  const showActuals = !!actuals?.hasActuals;

  // Totals: sum filled FTE per month across all visible customers
  const totals = useMemo(() => {
    const result = {};
    const filteredIds = new Set(filtered.map((c) => c.id));
    const visibleNeeds = needs.filter((n) => {
      const proj = projects.find((p) => p.id === n.projectId);
      if (!proj || !filteredIds.has(proj.customerId)) return false;
      if (!includePotential && n.status !== 'realised') return false;
      if (!includePotential && proj.status !== 'realised') return false;
      return true;
    });
    for (const m of months) {
      let filled = 0, needed = 0;
      for (const n of visibleNeeds) {
        // Skip months where this need has no demand, matching the per-row cells
        // (which continue on needed <= 0) so the footer can't exceed the rows.
        const need = (n.monthAllocations || {})[m] || 0;
        if (need <= 0) continue;
        needed += need;
        filled += assignments
          .filter((a) => a.needId === n.id && (!teamResourceIds || teamResourceIds.has(a.resourceId)))
          .reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
      }
      result[m] = { filled: Math.round(filled * 100) / 100, needed: Math.round(needed * 100) / 100 };
    }
    return result;
  }, [filtered, months, needs, projects, assignments, includePotential, teamResourceIds]);

  // Actual FTE logged per month, summed across the visible customers.
  const actualTotals = useMemo(() => {
    if (!showActuals) return {};
    const byCustomer = actuals?.byCustomer || {};
    const result = {};
    for (const m of months) {
      if (m > cur) continue;
      let hours = 0;
      for (const c of filtered) hours += byCustomer[c.id]?.[m] || 0;
      result[m] = hoursToFte(hours);
    }
    return result;
  }, [showActuals, actuals, filtered, months, cur]);

  // Footer scale: like the rows, floored at 1 FTE so tiny totals don't blow
  // up to full-width bars.
  const footerMax = useMemo(() => {
    let max = 1;
    for (const m of months) {
      max = Math.max(max, totals[m].filled, totals[m].needed);
      if (showActuals && m <= cur) max = Math.max(max, actualTotals[m] || 0);
    }
    return max;
  }, [months, totals, actualTotals, showActuals, cur]);

  if (filtered.length === 0) {
    return <EmptyState icon="🏢" message={includePotential ? 'No customers yet' : 'No realised customers'} />;
  }

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card overflow-auto">
      <h3 className="text-[17px] font-bold text-text px-5 pt-4 pb-2">
        Client Staffing{' '}
        <InfoDot text="Each month is a small bullet: the soft track is the planned (filled) staffing with a tick at its target, the solid bar is what was actually logged in Tempo, and the label underneath reads actual/planned. Once hours are synced the whole table reads in hours — same unit as the epic/task drill — with the FTE equivalents in the tooltip; without synced hours it reads in plain FTE. The Δ and its on/under/over verdict compare against the expected FTE — absences eat each assignee's free capacity first, so the plan only shrinks (pro-rata) once someone's total plan no longer fits their remaining hours; the tooltip shows the expected value whenever it differs. A red tick means the month is understaffed (planned < needed); an amber bar over a dashed baseline is unplanned work; a grey bar is the current month, still being logged. Bar lengths compare within a row. Expanding a customer drills into where the logged time actually went: the Jira epics behind its hours → their tasks → the people who logged them (actual hours only, on their own hour scale — Jira work rarely maps 1:1 onto planned needs, so the drill follows the hours instead). The plan side lives in the planner: use the plan → link under a customer’s name; profile → (or the name itself) opens the customer page. With a team selected, plan and logged hours both count only that team’s people (hours of people not matched to a Jira account can’t be attributed and drop out). Realised-only unless Include potential is on." />
        <ActualsLegend showAct={showActuals} />
      </h3>
      <ClientHeatmapHeader months={months} />
      {filtered.map((c, i) => (
        <CustomerHeatmapRow key={c.id} customer={c} index={i} months={months} includePotential={includePotential}
          teamResourceIds={teamResourceIds} teamId={teamId} actuals={showActuals ? actuals : null} />
      ))}
      {/* Totals row — same bullet language (and unit) as the rows above */}
      <div className="flex items-center border-t-2 border-border bg-[#F7FAFC] sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-[14px] font-bold text-text">{showActuals ? 'Total hours' : 'Total FTE'}</span>
          {showActuals && <span className="block text-[11px] font-semibold text-text-light">plan / act</span>}
        </div>
        {months.map((m) => (
          <HeatmapCell key={m} title={`All customers · ${formatMonth(m)}`}
            plan={totals[m].filled} needed={totals[m].needed}
            act={showActuals && m <= cur ? actualTotals[m] || 0 : null}
            max={footerMax} accent={FOOTER_ACCENT}
            isPotential={false} actualPartial={m === cur}
            inHours={showActuals} />
        ))}
      </div>
    </div>
  );
}
