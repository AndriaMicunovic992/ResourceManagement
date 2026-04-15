import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { monthRange, currentMonth, addMonths, formatMonth } from '../../../lib/dateUtils';
import { utilColor, utilBg } from '../../../lib/statusUtils';
import RoleBadge from '../../../components/badges/RoleBadge';
import StatusBadge from '../../../components/ui/StatusBadge';

/**
 * Viewer/self allocation view. Fetches /me/allocations so we don't have to
 * broaden customer/project visibility in the scope model. Shows the same
 * monthly utilization strip and per-project breakdown as the admin/manager
 * PersonAllocation, just without edit affordances.
 */
export default function SelfAllocation({ resource }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getMyAllocations()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load allocations');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const months = useMemo(
    () => monthRange(currentMonth(), addMonths(currentMonth(), 11)),
    []
  );

  // Planned utilization per month from realised assignments.
  const usageByMonth = useMemo(() => {
    const acc = {};
    if (!data?.assignments) return acc;
    for (const a of data.assignments) {
      const status = a.need?.project?.status;
      if (status === 'potential') continue;
      for (const [m, v] of Object.entries(a.monthAllocations || {})) {
        const num = Number(v) || 0;
        if (num <= 0) continue;
        acc[m] = (acc[m] || 0) + num;
      }
    }
    return acc;
  }, [data]);

  // Group assignments by customer → project for rendering.
  const grouped = useMemo(() => {
    if (!data?.assignments) return [];
    const byCustomer = {};
    for (const a of data.assignments) {
      const project = a.need?.project;
      const customer = project?.customer;
      if (!project || !customer) continue;
      if (!byCustomer[customer.id]) {
        byCustomer[customer.id] = { customer, projects: {} };
      }
      if (!byCustomer[customer.id].projects[project.id]) {
        byCustomer[customer.id].projects[project.id] = { project, assignments: [] };
      }
      byCustomer[customer.id].projects[project.id].assignments.push(a);
    }
    return Object.values(byCustomer);
  }, [data]);

  const capacity = resource?.capacity || data?.resource?.capacity || 1;

  if (loading) {
    return <div className="text-center text-text-light text-sm py-6">Loading…</div>;
  }
  if (error) {
    return <div className="text-xs text-danger bg-danger-bg p-3 rounded">{error}</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">
          Monthly Utilization
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {months.map((m) => {
            const used = usageByMonth[m] || 0;
            const pct = Math.round((used / capacity) * 100);
            const color = utilColor(pct);
            const bg = utilBg(pct);
            return (
              <div
                key={m}
                className="flex flex-col items-center rounded-lg p-1.5 min-w-[50px]"
                style={{ backgroundColor: bg }}
              >
                <span className="text-[8px] font-mono text-text-light">{formatMonth(m)}</span>
                <span className="text-xs font-bold font-mono" style={{ color }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center text-text-light text-sm py-6">Not assigned yet</div>
      ) : (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">
            Assigned To
          </div>
          {grouped.map((g) => (
            <div
              key={g.customer.id}
              className="border border-border rounded-lg p-3 mb-2"
              style={{
                borderColor: g.customer.status === 'potential' ? '#F5A623' : undefined,
              }}
            >
              <div className="font-bold text-sm text-text mb-2">{g.customer.name}</div>
              {Object.values(g.projects).map((pg) => {
                const allocMonths = pg.assignments.flatMap((a) =>
                  Object.entries(a.monthAllocations || {})
                    .filter(([, v]) => Number(v) > 0)
                    .map(([m]) => m)
                );
                const engStart = allocMonths.sort()[0];
                const engEnd = allocMonths.sort().slice(-1)[0];
                const totalFte = pg.assignments.reduce(
                  (sum, a) =>
                    sum +
                    Object.values(a.monthAllocations || {}).reduce(
                      (s, v) => s + (Number(v) || 0),
                      0
                    ),
                  0
                );
                return (
                  <div
                    key={pg.project.id}
                    className="ml-2 mb-2 p-2 bg-primary-bg/30 rounded"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-text">
                        {pg.project.name}
                      </span>
                      <StatusBadge status={pg.project.status} small />
                    </div>
                    {engStart && engEnd && (
                      <div className="text-[9px] font-mono text-text-light mt-0.5">
                        {formatMonth(engStart)}→{formatMonth(engEnd)} · {totalFte.toFixed(1)} FTE total
                      </div>
                    )}
                    {pg.assignments.map((a) => {
                      const activeMonths = Object.entries(a.monthAllocations || {}).filter(
                        ([, v]) => Number(v) > 0
                      );
                      const ms = activeMonths.map(([m]) => m).sort();
                      const avgFte =
                        activeMonths.length > 0
                          ? activeMonths.reduce((s, [, v]) => s + (Number(v) || 0), 0) /
                            activeMonths.length
                          : 0;
                      return (
                        <div key={a.id} className="flex items-center gap-1.5 mt-1">
                          <RoleBadge
                            domain={a.need.domain}
                            role={a.need.role}
                            seniority={a.need.seniority}
                            small
                          />
                          <StatusBadge status={a.need.status} small />
                          <span className="text-[9px] font-mono text-text-light flex-1">
                            {ms.length > 0 && `${formatMonth(ms[0])}→${formatMonth(ms.slice(-1)[0])}`}
                          </span>
                          <span className="text-[11px] font-bold font-mono text-primary">
                            {avgFte.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
