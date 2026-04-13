import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import StatCard from '../../dashboard/stats/StatCard';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { currentMonth, addMonths, monthRange } from '../../../lib/dateUtils';

export default function PersonOverview() {
  const { resource } = useOutletContext();
  const { assignments, needs, projects, customers } = useData();
  const { rURealised } = useComputed();

  const stats = useMemo(() => {
    const months = monthRange(currentMonth(), addMonths(currentMonth(), 2));
    const utils = months.map((m) => (rURealised[resource.id]?.[m] || 0) / resource.capacity);
    const avg = utils.length > 0 ? utils.reduce((a, b) => a + b, 0) / utils.length : 0;

    const resAssigns = assignments.filter((a) => a.resourceId === resource.id);
    const projectIds = new Set();
    const customerIds = new Set();
    for (const a of resAssigns) {
      const need = needs.find((n) => n.id === a.needId);
      if (!need) continue;
      const project = projects.find((p) => p.id === need.projectId);
      if (!project) continue;
      projectIds.add(project.id);
      customerIds.add(project.customerId);
    }
    const skillCount = (resource.personSkills || []).length;
    return {
      avgUtilPct: Math.round(avg * 100),
      projects: projectIds.size,
      customers: customerIds.size,
      skills: skillCount,
    };
  }, [resource, assignments, needs, projects, rURealised]);

  const activeCustomers = useMemo(() => {
    const now = currentMonth();
    const resAssigns = assignments.filter((a) => a.resourceId === resource.id);
    const map = new Map();
    for (const a of resAssigns) {
      const allocs = a.monthAllocations || {};
      const active = Object.keys(allocs).some((m) => m >= now && allocs[m] > 0);
      if (!active) continue;
      const need = needs.find((n) => n.id === a.needId);
      if (!need) continue;
      const project = projects.find((p) => p.id === need.projectId);
      if (!project) continue;
      const customer = customers.find((c) => c.id === project.customerId);
      if (!customer) continue;
      if (!map.has(customer.id)) map.set(customer.id, { customer, projects: new Set() });
      map.get(customer.id).projects.add(project.name);
    }
    return Array.from(map.values());
  }, [resource, assignments, needs, projects, customers]);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon="📈" value={`${stats.avgUtilPct}%`} label="Avg utilization (3mo)" color="#5BC68A" />
        <StatCard icon="📁" value={stats.projects} label="Projects" color="#3B82F6" />
        <StatCard icon="🏢" value={stats.customers} label="Customers" color="#F97316" />
        <StatCard icon="🎯" value={stats.skills} label="Skills" color="#8B5CF6" />
      </div>

      <div className="bg-white rounded-xl border border-border p-4">
        <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">
          Currently engaged with
        </div>
        {activeCustomers.length === 0 ? (
          <div className="text-xs text-text-light italic">No active engagements.</div>
        ) : (
          <div className="space-y-2">
            {activeCustomers.map(({ customer, projects }) => (
              <div key={customer.id} className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-text">{customer.name}</div>
                  <div className="text-[11px] text-text-light">
                    {Array.from(projects).join(' · ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
