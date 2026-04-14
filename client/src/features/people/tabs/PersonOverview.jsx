import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import StatCard from '../../dashboard/stats/StatCard';
import { useData } from '../../../contexts/DataContext';
import { useOrg } from '../../../contexts/OrgContext';
import { orgDefaultWindow } from './performance/PersonPerformance';
import { useComputed } from '../../../hooks/useComputed';
import { currentMonth, addMonths, monthRange } from '../../../lib/dateUtils';
import { api } from '../../../lib/api';

function PerformanceSparkline({ points }) {
  const valid = points.filter((p) => p.overall != null);
  if (valid.length < 2) return null;
  const width = 180;
  const height = 40;
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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[40px]">
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" />
    </svg>
  );
}

const KIND_COLORS = {
  good: 'bg-green-100 text-green-700',
  bad: 'bg-red-100 text-red-700',
  incident: 'bg-orange-100 text-orange-700',
  observation: 'bg-gray-100 text-gray-700',
  win: 'bg-emerald-100 text-emerald-700',
  down: 'bg-amber-100 text-amber-700',
  blocker: 'bg-rose-100 text-rose-700',
};

function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function formatRelative(date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return 'scheduled';
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export default function PersonOverview() {
  const { resource } = useOutletContext();
  const { assignments, needs, projects, customers, meResource } = useData();
  const { role, currentOrg } = useOrg();
  const { rURealised } = useComputed();
  const navigate = useNavigate();
  const isAdmin = role === 'admin' || role === 'owner';

  const isManager = useMemo(() => {
    if (!meResource) return false;
    const direct = Array.isArray(resource.managerLinks)
      ? resource.managerLinks.some(
          (l) => (l.managerId || l.manager?.id) === meResource.id
        )
      : false;
    const viaTeam = Array.isArray(resource.teams)
      ? resource.teams.some((t) => t.managerId === meResource.id)
      : false;
    return direct || viaTeam;
  }, [resource, meResource]);
  const canSeePerformance = isAdmin || isManager || meResource?.id === resource.id;

  const [lastOneOnOne, setLastOneOnOne] = useState(null);
  const [oneOnOneLoaded, setOneOnOneLoaded] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);
  const [recentLogsLoaded, setRecentLogsLoaded] = useState(false);
  const [performanceOverall, setPerformanceOverall] = useState(null);
  const [performanceTrend, setPerformanceTrend] = useState([]);
  const [performanceLoaded, setPerformanceLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isAdmin) {
      setLastOneOnOne(null);
      setOneOnOneLoaded(true);
      return;
    }
    setOneOnOneLoaded(false);
    api
      .listOneOnOnes(resource.id)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const sorted = [...list].sort(
          (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()
        );
        setLastOneOnOne(sorted[0] || null);
        setOneOnOneLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLastOneOnOne(null);
        setOneOnOneLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, resource.id]);

  useEffect(() => {
    let cancelled = false;
    if (!canSeePerformance) {
      setPerformanceOverall(null);
      setPerformanceTrend([]);
      setPerformanceLoaded(true);
      return;
    }
    setPerformanceLoaded(false);
    // Use the org's default trend window so the Overview card matches the
    // default view shown on the Performance tab.
    const { from, to } = orgDefaultWindow(currentOrg);
    Promise.all([
      api.getPerformanceOverall(resource.id, { from, to }).catch(() => null),
      api.getPerformanceTrend(resource.id, { bucket: 'month', from, to }).catch(() => []),
    ]).then(([overall, trend]) => {
      if (cancelled) return;
      setPerformanceOverall(overall);
      setPerformanceTrend(Array.isArray(trend) ? trend : []);
      setPerformanceLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [canSeePerformance, resource.id, currentOrg]);

  useEffect(() => {
    let cancelled = false;
    if (!isAdmin) {
      setRecentLogs([]);
      setRecentLogsLoaded(true);
      return;
    }
    setRecentLogsLoaded(false);
    api
      .listLogs(resource.id, { limit: 5 })
      .then((data) => {
        if (cancelled) return;
        setRecentLogs(Array.isArray(data) ? data : []);
        setRecentLogsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setRecentLogs([]);
        setRecentLogsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, resource.id]);

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

      {canSeePerformance && performanceLoaded && (
        <div
          onClick={() => navigate(`/people/${resource.id}/performance`)}
          className="bg-white rounded-xl border border-border p-4 mb-4 cursor-pointer hover:bg-primary-bg/40"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
              Performance
            </div>
            <div className="text-[10px] text-text-light">
              {performanceOverall?.evaluations?.length
                ? `${performanceOverall.evaluations.length} finalized`
                : 'No finalized evaluations'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {performanceOverall?.overall != null ? (
                <div className="text-3xl font-bold text-primary leading-none">
                  {performanceOverall.overall.toFixed(1)}
                </div>
              ) : (
                <div className="text-2xl font-bold text-text-light leading-none">—</div>
              )}
              <div className="text-[10px] text-text-light mt-1">Overall (weighted)</div>
            </div>
            <div className="flex-1 min-w-0">
              <PerformanceSparkline points={performanceTrend} />
            </div>
          </div>
        </div>
      )}

      {isAdmin && oneOnOneLoaded && (
        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">
            Last 1:1
          </div>
          {lastOneOnOne ? (
            <div className="text-xs text-text">
              {new Date(lastOneOnOne.meetingDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}{' '}
              <span className="text-text-light">
                ({formatRelative(new Date(lastOneOnOne.meetingDate))})
              </span>
            </div>
          ) : (
            <div className="text-xs text-text-light italic">No 1:1 meetings recorded yet.</div>
          )}
        </div>
      )}

      {isAdmin && recentLogsLoaded && (
        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-2">
            Recent activity
          </div>
          {recentLogs.length === 0 ? (
            <div className="text-xs text-text-light italic">No activity yet</div>
          ) : (
            <div className="space-y-1.5">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => navigate(`/people/${resource.id}/activity`)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-primary-bg"
                >
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                      KIND_COLORS[log.kind] || KIND_COLORS.observation
                    }`}
                  >
                    {log.kind}
                  </span>
                  <div className="text-xs text-text truncate flex-1">
                    {truncate(log.content, 100)}
                  </div>
                  <div className="text-[10px] text-text-light shrink-0">
                    {new Date(log.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
