import { useMemo } from 'react';
import StatCard from './StatCard';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { currentMonth } from '../../../lib/dateUtils';

export default function StatsCards() {
  const { customers, projects, resources, needs, assignments } = useData();
  const { rURealised, nF } = useComputed();
  const cm = currentMonth();

  const stats = useMemo(() => {
    // Active realised projects that haven't ended yet
    const activeProjects = projects.filter((p) => p.status === 'realised' && p.endMonth >= cm).length;

    // Team size
    const teamSize = resources.length;

    // Realised utilization for current month
    let totalRealisedFte = 0;
    let totalCapacity = 0;
    for (const r of resources) {
      totalCapacity += r.capacity;
      totalRealisedFte += rURealised[r.id]?.[cm] || 0;
    }
    const utilPct = totalCapacity > 0 ? Math.round((totalRealisedFte / totalCapacity) * 100) : 0;

    // Unfilled need-month pairs (realised only)
    let unfilled = 0;
    for (const n of needs) {
      if (n.status !== 'realised') continue;
      const project = projects.find((p) => p.id === n.projectId);
      if (!project || project.status !== 'realised') continue;
      const customer = customers.find((c) => c.id === project.customerId);
      if (!customer || customer.status !== 'realised') continue;
      const allocs = n.monthAllocations || {};
      for (const [m, needed] of Object.entries(allocs)) {
        const filled = nF[n.id]?.[m]?.filled || 0;
        if (needed > 0 && filled < needed) unfilled++;
      }
    }

    return { activeProjects, teamSize, utilPct, unfilled };
  }, [projects, resources, needs, customers, assignments, rURealised, nF, cm]);

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatCard icon="📋" value={stats.activeProjects} label="Projects" color="#3B82F6" />
      <StatCard icon="👥" value={stats.teamSize} label="Team" color="#5BC68A" />
      <StatCard icon="📊" value={`${stats.utilPct}%`} label="Utilization" color="#F5A623" />
      <StatCard icon="⚠️" value={stats.unfilled} label="Unfilled" color="#E8636F" />
    </div>
  );
}
