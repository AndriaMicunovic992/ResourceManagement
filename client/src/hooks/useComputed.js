import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';

export function useComputed() {
  const { customers, projects, needs, assignments, resources } = useData();

  // Resource utilization per month (all assignments). Iterate assignments once
  // and bucket by resource — linear, instead of filtering all assignments per
  // resource (O(resources × assignments)).
  const rU = useMemo(() => {
    const map = {};
    for (const r of resources) map[r.id] = {};
    for (const a of assignments) {
      const rMap = map[a.resourceId];
      if (!rMap) continue; // assignment for a resource not in the loaded set
      const allocs = a.monthAllocations || {};
      for (const [m, fte] of Object.entries(allocs)) rMap[m] = (rMap[m] || 0) + fte;
    }
    return map;
  }, [resources, assignments]);

  // Realised resource utilization — same single pass, with needs/projects/
  // customers indexed by id rather than a linear find per assignment.
  const rURealised = useMemo(() => {
    const needById = new Map(needs.map((n) => [n.id, n]));
    const projById = new Map(projects.map((p) => [p.id, p]));
    const custById = new Map(customers.map((c) => [c.id, c]));
    const map = {};
    for (const r of resources) map[r.id] = {};
    for (const a of assignments) {
      const rMap = map[a.resourceId];
      if (!rMap) continue;
      const need = needById.get(a.needId);
      if (!need || need.status !== 'realised') continue;
      const project = projById.get(need.projectId);
      if (!project || project.status !== 'realised') continue;
      const customer = custById.get(project.customerId);
      if (!customer || customer.status !== 'realised') continue;
      const allocs = a.monthAllocations || {};
      for (const [m, fte] of Object.entries(allocs)) rMap[m] = (rMap[m] || 0) + fte;
    }
    return map;
  }, [resources, assignments, needs, projects, customers]);

  // Need fulfillment — bucket assignments by need once, then reduce per month.
  const nF = useMemo(() => {
    const byNeed = new Map();
    for (const a of assignments) {
      const arr = byNeed.get(a.needId);
      if (arr) arr.push(a);
      else byNeed.set(a.needId, [a]);
    }
    const map = {};
    for (const n of needs) {
      map[n.id] = {};
      const needAllocs = n.monthAllocations || {};
      const needAssigns = byNeed.get(n.id) || [];
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
