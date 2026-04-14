import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';
import { currentMonth, addMonths } from '../../../lib/dateUtils';
import StatCard from '../../dashboard/stats/StatCard';
import LogCard from '../../people/tabs/activity/LogCard';

function Sparkline({ points }) {
  const valid = points.filter((p) => p.overall != null);
  if (valid.length < 2) return null;
  const width = 240;
  const height = 48;
  const minY = 1;
  const maxY = 5;
  const stepX = width / (valid.length - 1);
  const path = valid
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.overall - minY) / (maxY - minY)) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[48px]">
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" />
    </svg>
  );
}

export default function CustomerOverview() {
  const { customer } = useOutletContext();
  const { role } = useOrg();
  const { projects, needs, assignments, resources } = useData();
  const navigate = useNavigate();
  const isAdmin = role === 'admin' || role === 'owner';

  const [recentLogs, setRecentLogs] = useState([]);
  const [trend, setTrend] = useState([]);
  const [overall, setOverall] = useState(null);

  // Pull recent activity (top 5) and performance trend on mount.
  useEffect(() => {
    let cancelled = false;
    api
      .getCustomerActivity(customer.id, { limit: 5 })
      .then((data) => {
        if (cancelled) return;
        setRecentLogs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setRecentLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const from = addMonths(currentMonth(), -11) + '-01';
    api
      .getCustomerPerformanceTrend(customer.id, { bucket: 'month', from })
      .then((data) => {
        if (cancelled) return;
        setTrend(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setTrend([]);
      });
    api
      .getCustomerPerformanceOverall(customer.id, { from })
      .then((data) => {
        if (cancelled) return;
        setOverall(data);
      })
      .catch(() => {
        if (cancelled) return;
        setOverall(null);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id, isAdmin]);

  // Compute some basic stats directly from DataContext.
  const stats = useMemo(() => {
    const custProjects = projects.filter((p) => p.customerId === customer.id);
    const custProjectIds = new Set(custProjects.map((p) => p.id));
    const custNeeds = needs.filter((n) => custProjectIds.has(n.projectId));
    const needIds = new Set(custNeeds.map((n) => n.id));

    // "Currently staffed" people = distinct resources with any non-zero
    // allocation on this customer's needs in the current month.
    const now = currentMonth();
    const peopleNow = new Set();
    for (const a of assignments) {
      if (!needIds.has(a.needId)) continue;
      const v = (a.monthAllocations || {})[now] || 0;
      if (v > 0) peopleNow.add(a.resourceId);
    }
    return {
      projectCount: custProjects.length,
      needCount: custNeeds.length,
      staffedNow: peopleNow.size,
    };
  }, [customer.id, projects, needs, assignments]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="📁" value={stats.projectCount} label="Projects" color="#6366f1" />
        <StatCard icon="🎯" value={stats.needCount} label="Needs" color="#0ea5e9" />
        <StatCard icon="👥" value={stats.staffedNow} label="Staffed now" color="#10b981" />
        {isAdmin && (
          <StatCard
            icon="📊"
            value={overall?.overall != null ? overall.overall.toFixed(1) : '—'}
            label="Overall (12m)"
            color="#f59e0b"
          />
        )}
      </div>

      {isAdmin && trend.length >= 2 && (
        <div className="bg-white rounded-xl border border-border shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-text-mid uppercase tracking-wider">
              Performance trend · 12 months
            </div>
            <button
              onClick={() => navigate(`/customers/${customer.id}/performance`)}
              className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
            >
              Open ›
            </button>
          </div>
          <Sparkline points={trend} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-border shadow-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-text-mid uppercase tracking-wider">
            Recent activity
          </div>
          <button
            onClick={() => navigate(`/customers/${customer.id}/activity`)}
            className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
          >
            View all ›
          </button>
        </div>
        {recentLogs.length === 0 ? (
          <div className="text-xs text-text-light">No activity yet.</div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => {
              const person = resources.find((r) => r.id === log.resourceId);
              return (
                <div key={log.id}>
                  {person && (
                    <div className="text-[11px] text-text-light mb-1">
                      on{' '}
                      <button
                        onClick={() => navigate(`/people/${person.id}`)}
                        className="font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
                      >
                        {person.name}
                      </button>
                    </div>
                  )}
                  <LogCard log={log} resourceId={log.resourceId} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
