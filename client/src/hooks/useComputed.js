import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';

export function useComputed() {
  const { customers, projects, needs, assignments, resources } = useData();

  // Resource utilization per month (all assignments)
  const rU = useMemo(() => {
    const map = {};
    for (const r of resources) {
      map[r.id] = {};
      const resAssigns = assignments.filter((a) => a.resourceId === r.id);
      for (const a of resAssigns) {
        const allocs = a.monthAllocations || {};
        for (const [m, fte] of Object.entries(allocs)) {
          map[r.id][m] = (map[r.id][m] || 0) + fte;
        }
      }
    }
    return map;
  }, [resources, assignments]);

  // Realised resource utilization
  const rURealised = useMemo(() => {
    const map = {};
    for (const r of resources) {
      map[r.id] = {};
      const resAssigns = assignments.filter((a) => a.resourceId === r.id);
      for (const a of resAssigns) {
        const need = needs.find((n) => n.id === a.needId);
        if (!need || need.status !== 'realised') continue;
        const project = projects.find((p) => p.id === need.projectId);
        if (!project || project.status !== 'realised') continue;
        const customer = customers.find((c) => c.id === project.customerId);
        if (!customer || customer.status !== 'realised') continue;

        const allocs = a.monthAllocations || {};
        for (const [m, fte] of Object.entries(allocs)) {
          map[r.id][m] = (map[r.id][m] || 0) + fte;
        }
      }
    }
    return map;
  }, [resources, assignments, needs, projects, customers]);

  // Need fulfillment
  const nF = useMemo(() => {
    const map = {};
    for (const n of needs) {
      map[n.id] = {};
      const needAllocs = n.monthAllocations || {};
      const needAssigns = assignments.filter((a) => a.needId === n.id);
      for (const m of Object.keys(needAllocs)) {
        const needed = needAllocs[m] || 0;
        const filled = needAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        map[n.id][m] = { needed, filled, ok: filled >= needed && needed > 0 };
      }
    }
    return map;
  }, [needs, assignments]);

  return { rU, rURealised, nF };
}
