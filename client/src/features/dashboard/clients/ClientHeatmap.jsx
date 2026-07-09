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
  const showActuals = !!actuals?.hasActuals && !teamId; // hours aren't team-attributable

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
      <h3 className="text-[13px] font-bold text-text px-5 pt-4 pb-2">
        Client Staffing{' '}
        <InfoDot text="Each month is a small bullet: the soft track is the planned (filled) FTE with a tick at its target, the solid bar is the FTE actually logged in Tempo, and the label underneath reads actual/planned. The Δ and its on/under/over verdict compare against the expected FTE — absences eat each assignee's free capacity first, so the plan only shrinks (pro-rata) once someone's total plan no longer fits their remaining hours; the tooltip shows the expected value whenever it differs. A red tick means the month is understaffed (planned < needed); an amber bar over a dashed baseline is unplanned work; a grey bar is the current month, still being logged. Bar lengths compare within a row. Project rows only show hours mapped to that project, so the customer row is the authoritative total. Logged hours can’t be split by team, so the actual layer hides while a team filter is on. Realised-only unless Include potential is on." />
        <ActualsLegend showAct={showActuals} />
      </h3>
      <ClientHeatmapHeader months={months} />
      {filtered.map((c, i) => (
        <CustomerHeatmapRow key={c.id} customer={c} index={i} months={months} includePotential={includePotential}
          teamResourceIds={teamResourceIds} actuals={showActuals ? actuals : null} />
      ))}
      {/* Totals row — same bullet language as the rows above */}
      <div className="flex items-center border-t-2 border-border bg-[#F7FAFC] sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-bold text-text">Total FTE</span>
          {showActuals && <span className="block text-[9px] font-semibold text-text-light">plan / act</span>}
        </div>
        {months.map((m) => (
          <HeatmapCell key={m} title={`All customers · ${formatMonth(m)}`}
            plan={totals[m].filled} needed={totals[m].needed}
            act={showActuals && m <= cur ? actualTotals[m] || 0 : null}
            max={footerMax} accent={FOOTER_ACCENT}
            isPotential={false} actualPartial={m === cur} />
        ))}
      </div>
    </div>
  );
}
