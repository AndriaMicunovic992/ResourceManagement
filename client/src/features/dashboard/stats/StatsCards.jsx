import { useMemo } from 'react';
import StatCard from './StatCard';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';

export default function StatsCards({ months, includePotential, teamId }) {
  const { customers, projects, resources, needs } = useData();
  const { rURealised, rU, nF } = useComputed();

  const stats = useMemo(() => {
    const monthSet = new Set(months);
    const teamResources = teamId ? resources.filter((r) => (r.teams || []).some((t) => t.id === teamId)) : resources;

    // Active projects that overlap with the selected time range
    const activeProjects = projects.filter((p) => {
      if (!includePotential && p.status !== 'realised') return false;
      if (!p.startMonth || !p.endMonth) return false;
      return p.startMonth <= months[months.length - 1] && p.endMonth >= months[0];
    }).length;

    // Team size
    const teamSize = teamResources.length;

    // Utilization averaged across selected months
    let totalUsedFte = 0;
    let totalCapacity = 0;
    const rUsed = includePotential ? rU : rURealised;
    for (const r of teamResources) {
      for (const m of months) {
        totalCapacity += r.capacity;
        totalUsedFte += rUsed[r.id]?.[m] || 0;
      }
    }
    const utilPct = totalCapacity > 0 ? Math.round((totalUsedFte / totalCapacity) * 100) : 0;

    // Unfilled needs within the selected time range
    let unfilled = 0;
    for (const n of needs) {
      if (!includePotential && n.status !== 'realised') continue;
      const project = projects.find((p) => p.id === n.projectId);
      if (!project) continue;
      if (!includePotential && project.status !== 'realised') continue;
      const customer = customers.find((c) => c.id === project.customerId);
      if (!customer) continue;
      if (!includePotential && customer.status !== 'realised') continue;

      const allocs = n.monthAllocations || {};
      const hasUnfilledMonth = Object.entries(allocs).some(([m, needed]) => {
        if (!monthSet.has(m)) return false;
        const filled = nF[n.id]?.[m]?.filled || 0;
        return needed > 0 && filled < needed;
      });
      if (hasUnfilledMonth) unfilled++;
    }

    return { activeProjects, teamSize, utilPct, unfilled };
  }, [projects, resources, needs, customers, rURealised, rU, nF, months, includePotential, teamId]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
      <StatCard icon="▦" value={stats.activeProjects} label="Projects" color="#3B82F6"
        info="Projects overlapping the selected months. With “Include potential” off, only realised projects count." />
      <StatCard icon="◑" value={stats.teamSize} label="People" color="#5BC68A"
        info="People in scope — the whole org, or the selected team." />
      <StatCard icon="◔" value={`${stats.utilPct}%`} label="Utilization" color="#F5A623"
        info="Averaged over the selected months: Σ used FTE ÷ Σ capacity. “Used” is realised allocation, or all planned allocation when “Include potential” is on." />
      <StatCard icon="◌" value={stats.unfilled} label="Unfilled" color="#E8636F"
        info="Needs with at least one selected month where filled < needed. “Include potential” off limits it to realised needs/projects/customers." />
    </div>
  );
}
