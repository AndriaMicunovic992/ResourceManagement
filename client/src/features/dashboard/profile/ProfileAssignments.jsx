import { useMemo } from 'react';
import RoleBadge from '../../../components/badges/RoleBadge';
import StatusBadge from '../../../components/ui/StatusBadge';
import { formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';

export default function ProfileAssignments({ resource }) {
  const { assignments, needs, projects, customers } = useData();

  const grouped = useMemo(() => {
    const resAssigns = assignments.filter((a) => a.resourceId === resource.id);
    const byCustomer = {};

    for (const a of resAssigns) {
      const need = needs.find((n) => n.id === a.needId);
      if (!need) continue;
      const project = projects.find((p) => p.id === need.projectId);
      if (!project) continue;
      const customer = customers.find((c) => c.id === project.customerId);
      if (!customer) continue;

      if (!byCustomer[customer.id]) {
        byCustomer[customer.id] = { customer, projects: {} };
      }
      if (!byCustomer[customer.id].projects[project.id]) {
        byCustomer[customer.id].projects[project.id] = { project, assignments: [] };
      }
      byCustomer[customer.id].projects[project.id].assignments.push({ assignment: a, need });
    }

    return Object.values(byCustomer);
  }, [resource, assignments, needs, projects, customers]);

  if (grouped.length === 0) {
    return <div className="text-center text-text-light text-sm py-6">Not assigned yet</div>;
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">Assigned To</div>
      {grouped.map((g) => (
        <div key={g.customer.id} className="border border-border rounded-lg p-3 mb-2"
          style={{ borderColor: g.customer.status === 'potential' ? '#F5A623' : undefined }}>
          <div className="font-bold text-sm text-text mb-2">{g.customer.name}</div>
          {Object.values(g.projects).map((pg) => {
            const allocs = pg.assignments.flatMap((a) =>
              Object.entries(a.assignment.monthAllocations || {}).filter(([, v]) => v > 0).map(([m]) => m)
            );
            const engStart = allocs.sort()[0];
            const engEnd = allocs.sort().slice(-1)[0];
            const totalFte = pg.assignments.reduce((sum, a) =>
              sum + Object.values(a.assignment.monthAllocations || {}).reduce((s, v) => s + v, 0), 0);

            return (
              <div key={pg.project.id} className="ml-2 mb-2 p-2 bg-primary-bg/30 rounded">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-text">{pg.project.name}</span>
                  <StatusBadge status={pg.project.status} small />
                </div>
                <div className="text-[9px] font-mono text-text-light mt-0.5">
                  {formatMonth(engStart)}→{formatMonth(engEnd)} · {totalFte.toFixed(1)} FTE total
                </div>
                {pg.assignments.map((a, i) => {
                  const activeMonths = Object.entries(a.assignment.monthAllocations || {}).filter(([, v]) => v > 0);
                  const ms = activeMonths.map(([m]) => m).sort();
                  const avgFte = activeMonths.length > 0
                    ? activeMonths.reduce((s, [, v]) => s + v, 0) / activeMonths.length : 0;
                  return (
                    <div key={i} className="flex items-center gap-1.5 mt-1">
                      <RoleBadge domain={a.need.domain} role={a.need.role} seniority={a.need.seniority} small />
                      <StatusBadge status={a.need.status} small />
                      <span className="text-[9px] font-mono text-text-light flex-1">
                        {formatMonth(ms[0])}→{formatMonth(ms.slice(-1)[0])}
                      </span>
                      <span className="text-[11px] font-bold font-mono text-primary">{avgFte.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
