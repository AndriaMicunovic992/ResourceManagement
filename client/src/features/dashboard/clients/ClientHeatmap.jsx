import { useMemo } from 'react';
import ClientHeatmapHeader from './ClientHeatmapHeader';
import CustomerHeatmapRow from './CustomerHeatmapRow';
import EmptyState from '../../../components/ui/EmptyState';
import InfoDot from '../../../components/ui/InfoDot';
import ActualsLegend from '../ActualsLegend';
import { useData } from '../../../contexts/DataContext';
import { currentMonth } from '../../../lib/dateUtils';
import { hoursToFte } from '../../../lib/constants';
import { actualVsPlanColor } from '../../../lib/statusUtils';

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
      let filled = 0;
      for (const n of visibleNeeds) {
        // Skip months where this need has no demand, matching the per-row cells
        // (which continue on needed <= 0) so the footer can't exceed the rows.
        if (((n.monthAllocations || {})[m] || 0) <= 0) continue;
        filled += assignments
          .filter((a) => a.needId === n.id && (!teamResourceIds || teamResourceIds.has(a.resourceId)))
          .reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
      }
      result[m] = Math.round(filled * 100) / 100;
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

  if (filtered.length === 0) {
    return <EmptyState icon="🏢" message={includePotential ? 'No customers yet' : 'No realised customers'} />;
  }

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card overflow-auto">
      <h3 className="text-[13px] font-bold text-text px-5 pt-4 pb-2">
        Client Staffing{' '}
        <InfoDot text="Each cell = filled ÷ needed FTE for that customer/project that month (summed over its needs), plus the filled FTE. For elapsed months, “act” underneath is the FTE actually logged in Tempo — green ≈ on plan (85–115%), amber under, red over; amber with no plan above it is unplanned work. Project rows only show hours mapped to that project, so the customer row is the authoritative total. Logged hours can’t be split by team, so the act layer hides while a team filter is on. Realised-only unless Include potential is on." />
        {showActuals && <ActualsLegend />}
      </h3>
      <ClientHeatmapHeader months={months} />
      {filtered.map((c, i) => (
        <CustomerHeatmapRow key={c.id} customer={c} index={i} months={months} includePotential={includePotential}
          teamResourceIds={teamResourceIds} actuals={showActuals ? actuals : null} />
      ))}
      {/* Totals row */}
      <div className="flex items-center border-t-2 border-border bg-primary-bg/30 sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-bold text-text">Total FTE</span>
          {showActuals && <span className="block text-[9px] font-semibold text-text-light">plan / act</span>}
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 flex flex-col items-center justify-center py-0.5">
            <span className="text-[11px] font-mono font-bold text-primary">
              {totals[m] > 0 ? totals[m].toFixed(1) : '—'}
            </span>
            {showActuals && m <= cur && (
              <span className="text-[9px] font-mono font-semibold leading-tight"
                style={{ color: m === cur ? '#9CA3AF' : actualVsPlanColor(actualTotals[m] || 0, totals[m]) }}>
                act {(actualTotals[m] || 0).toFixed(1)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
