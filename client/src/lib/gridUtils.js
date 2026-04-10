import { monthRange } from './dateUtils';

export function buildRows(customers, projects, needs) {
  const rows = [];
  for (const customer of customers) {
    rows.push({ type: 'customer', data: customer });
    const custProjects = projects.filter((p) => p.customerId === customer.id);
    for (const project of custProjects) {
      rows.push({ type: 'project', data: project, customer });
      const projNeeds = needs.filter((n) => n.projectId === project.id);
      if (projNeeds.length === 0) {
        rows.push({ type: 'empty', data: project, customer });
      } else {
        for (const need of projNeeds) {
          rows.push({ type: 'need', data: need, project, customer });
        }
      }
    }
  }
  return rows;
}

export function buildSegments(assignment) {
  const allocs = assignment.monthAllocations || {};
  const months = Object.keys(allocs).sort().filter((m) => allocs[m] > 0);
  if (months.length === 0) return [];

  const segments = [];
  let seg = { start: months[0], end: months[0], fte: allocs[months[0]], months: [months[0]] };

  for (let i = 1; i < months.length; i++) {
    const m = months[i];
    if (allocs[m] === seg.fte && isConsecutive(seg.end, m)) {
      seg.end = m;
      seg.months.push(m);
    } else {
      segments.push(seg);
      seg = { start: m, end: m, fte: allocs[m], months: [m] };
    }
  }
  segments.push(seg);
  return segments;
}

function isConsecutive(a, b) {
  const [ay, am] = a.split('-').map(Number);
  let ny = ay, nm = am + 1;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2, '0')}` === b;
}

export function computeNeedFulfillment(need, assignments) {
  const needAllocs = need.monthAllocations || {};
  const needAssigns = assignments.filter((a) => a.needId === need.id);
  const result = {};
  for (const m of Object.keys(needAllocs)) {
    const needed = needAllocs[m] || 0;
    const filled = needAssigns.reduce((sum, a) => sum + ((a.monthAllocations || {})[m] || 0), 0);
    result[m] = { needed, filled, ok: filled >= needed && needed > 0 };
  }
  return result;
}

export function isNeedOk(need, assignments) {
  const nf = computeNeedFulfillment(need, assignments);
  const months = Object.keys(nf);
  return months.length > 0 && months.every((m) => nf[m].ok);
}

export function isProjectOk(project, needs, assignments) {
  const projNeeds = needs.filter((n) => n.projectId === project.id);
  return projNeeds.length > 0 && projNeeds.every((n) => isNeedOk(n, assignments));
}

export function isCustomerOk(customer, projects, needs, assignments) {
  const custProjects = projects.filter((p) => p.customerId === customer.id);
  return custProjects.length > 0 && custProjects.every((p) => isProjectOk(p, needs, assignments));
}
