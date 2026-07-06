import { useMemo } from 'react';
import ClientHeatmapHeader from './ClientHeatmapHeader';
import CustomerHeatmapRow from './CustomerHeatmapRow';
import EmptyState from '../../../components/ui/EmptyState';
import InfoDot from '../../../components/ui/InfoDot';
import { useData } from '../../../contexts/DataContext';

export default function ClientHeatmap({ months, includePotential, teamId }) {
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

  if (filtered.length === 0) {
    return <EmptyState icon="🏢" message={includePotential ? 'No customers yet' : 'No realised customers'} />;
  }

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card overflow-auto">
      <h3 className="text-[13px] font-bold text-text px-5 pt-4 pb-2">
        Client Staffing{' '}
        <InfoDot text="Each cell = filled ÷ needed FTE for that customer/project that month (summed over its needs). The “Total FTE” footer sums filled assignment FTE across all shown needs per month. Realised-only unless Include potential is on." />
      </h3>
      <ClientHeatmapHeader months={months} />
      {filtered.map((c, i) => (
        <CustomerHeatmapRow key={c.id} customer={c} index={i} months={months} includePotential={includePotential} teamResourceIds={teamResourceIds} />
      ))}
      {/* Totals row */}
      <div className="flex items-center border-t-2 border-border bg-primary-bg/30 sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-bold text-text">Total FTE</span>
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono font-bold text-primary">
            {totals[m] > 0 ? totals[m].toFixed(1) : '—'}
          </div>
        ))}
      </div>
    </div>
  );
}
