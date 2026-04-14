import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { useOrg } from '../../../../contexts/OrgContext';
import { useData } from '../../../../contexts/DataContext';
import EmptyState from '../../../../components/ui/EmptyState';
import NewEvaluationModal from './NewEvaluationModal';
import EvaluationDetail from './EvaluationDetail';

const STATE_LABELS = {
  draft: 'Draft',
  employee_submitted: 'Self submitted',
  responsible_submitted: 'Responsible submitted',
  finalized: 'Finalized',
};

const STATE_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  employee_submitted: 'bg-blue-100 text-blue-700',
  responsible_submitted: 'bg-amber-100 text-amber-700',
  finalized: 'bg-emerald-100 text-emerald-700',
};

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatBucketLabel(bucketStart, bucket) {
  if (typeof bucketStart !== 'string') return String(bucketStart);
  if (bucket === 'quarter') {
    // "YYYY-Q{1-4}"
    const m = bucketStart.match(/^(\d{4})-Q([1-4])$/);
    if (!m) return bucketStart;
    return `Q${m[2]} ${m[1]}`;
  }
  // "YYYY-MM"
  const m = bucketStart.match(/^(\d{4})-(\d{2})$/);
  if (!m) return bucketStart;
  return `${MONTH_SHORT[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

function TrendChart({ points, bucket }) {
  if (!points || points.length === 0) {
    return (
      <div className="text-[11px] text-text-light italic py-6 text-center">
        No finalized evaluations yet — the trend chart will appear once evaluations are finalized.
      </div>
    );
  }
  const width = 560;
  const height = 140;
  const padding = { top: 12, right: 12, bottom: 24, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const minY = 1;
  const maxY = 5;
  const n = points.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;

  const xy = points.map((p, i) => {
    const x = padding.left + (n > 1 ? i * stepX : innerW / 2);
    const v = p.overall == null ? null : Math.max(minY, Math.min(maxY, p.overall));
    const y =
      v == null
        ? null
        : padding.top + innerH - ((v - minY) / (maxY - minY)) * innerH;
    return { x, y, point: p };
  });

  const linePath = xy
    .filter((q) => q.y != null)
    .map((q, i) => `${i === 0 ? 'M' : 'L'}${q.x},${q.y}`)
    .join(' ');

  const yTicks = [1, 2, 3, 4, 5];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[140px]">
      {yTicks.map((t) => {
        const y = padding.top + innerH - ((t - minY) / (maxY - minY)) * innerH;
        return (
          <g key={t}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text
              x={padding.left - 4}
              y={y + 3}
              textAnchor="end"
              className="fill-text-light"
              style={{ fontSize: '9px' }}
            >
              {t}
            </text>
          </g>
        );
      })}
      {linePath && (
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" />
      )}
      {xy.map((q, i) =>
        q.y == null ? null : (
          <g key={i}>
            <circle cx={q.x} cy={q.y} r="3" fill="#6366f1" />
            <title>
              {formatBucketLabel(q.point.bucketStart, bucket)}: {q.point.overall?.toFixed(1)} ({q.point.evaluationCount} eval
              {q.point.evaluationCount === 1 ? '' : 's'})
            </title>
          </g>
        )
      )}
      {xy.map((q, i) => {
        if (n <= 1) return null;
        if (i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null;
        return (
          <text
            key={`lbl-${i}`}
            x={q.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-text-light"
            style={{ fontSize: '9px' }}
          >
            {formatBucketLabel(q.point.bucketStart, bucket)}
          </text>
        );
      })}
    </svg>
  );
}

export default function PersonPerformance() {
  const { resource } = useOutletContext();
  const { role } = useOrg();
  const { user } = useAuth();
  const { meResource } = useData();
  const isAdmin = role === 'admin' || role === 'owner';

  // Client-side manager check: is the viewing user a manager of this person?
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

  const isSelf = meResource?.id === resource.id;
  const canView = isAdmin || isManager || isSelf;
  const canCreate = isAdmin || isManager;

  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendBucket, setTrendBucket] = useState('month');
  const [trend, setTrend] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  // Category breakdown scope filter — "" = all, "c:<id>" = customer, "p:<id>" = project
  const [breakdownScope, setBreakdownScope] = useState('');
  const [categories, setCategories] = useState([]);

  const reloadEvaluations = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      const list = await api.listEvaluations({ resourceId: resource.id });
      setEvaluations(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Failed to load evaluations');
    }
    setLoading(false);
  }, [canView, resource.id]);

  const reloadTrend = useCallback(async () => {
    if (!canView) return;
    try {
      const data = await api.getPerformanceTrend(resource.id, trendBucket);
      setTrend(Array.isArray(data) ? data : []);
    } catch {
      setTrend([]);
    }
  }, [canView, resource.id, trendBucket]);

  const reloadCategories = useCallback(async () => {
    if (!canView) return;
    const params = {};
    if (breakdownScope.startsWith('c:')) params.customerId = breakdownScope.slice(2);
    else if (breakdownScope.startsWith('p:')) params.projectId = breakdownScope.slice(2);
    try {
      const data = await api.getPerformanceCategories(resource.id, params);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  }, [canView, resource.id, breakdownScope]);

  useEffect(() => {
    reloadEvaluations();
  }, [reloadEvaluations]);

  useEffect(() => {
    reloadTrend();
  }, [reloadTrend]);

  useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    api
      .getEvaluation(selectedId)
      .then((data) => {
        if (cancelled) return;
        setSelectedDetail(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load evaluation');
        setSelectedDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Distinct scopes present in this person's evaluations, for the breakdown filter.
  const scopeOptions = useMemo(() => {
    const opts = [];
    const customerSeen = new Set();
    const projectSeen = new Set();
    for (const ev of evaluations) {
      if (ev.customerId && !customerSeen.has(ev.customerId)) {
        customerSeen.add(ev.customerId);
        opts.push({
          value: `c:${ev.customerId}`,
          label: ev.customerNameSnapshot || '—',
        });
      }
      if (ev.projectId && !projectSeen.has(ev.projectId)) {
        projectSeen.add(ev.projectId);
        opts.push({
          value: `p:${ev.projectId}`,
          label: `${ev.customerNameSnapshot || '—'} · ${ev.projectNameSnapshot || '—'}`,
        });
      }
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [evaluations]);

  // Group the breakdown rows by their grouping label for rendering.
  const categoriesByGrouping = useMemo(() => {
    const map = new Map();
    for (const row of categories) {
      const key = row.grouping || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return Array.from(map.entries()).map(([grouping, rows]) => ({ grouping, rows }));
  }, [categories]);

  // Group by "round" = shared periodEnd (the batch parameter users pick).
  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of evaluations) {
      const key = ev.periodEnd ? String(ev.periodEnd).slice(0, 10) : 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          key,
          periodEnd: ev.periodEnd,
          items: [],
        });
      }
      map.get(key).items.push(ev);
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.items.sort((a, b) =>
        (a.customerNameSnapshot || '').localeCompare(b.customerNameSnapshot || '')
      );
    }
    groups.sort(
      (a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()
    );
    return groups;
  }, [evaluations]);

  const handleCreated = async (created) => {
    setShowNewModal(false);
    await reloadEvaluations();
    if (Array.isArray(created) && created.length > 0) {
      setSelectedId(created[0].id);
    }
  };

  const handleDetailChange = (updated) => {
    setEvaluations((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
    setSelectedDetail(updated);
    // Trend + breakdown depend on finalized state — refresh when it could have changed.
    if (updated.state === 'finalized') {
      reloadTrend();
      reloadCategories();
    }
  };

  const handleDetailDeleted = async (id) => {
    setSelectedId(null);
    setSelectedDetail(null);
    setEvaluations((prev) => prev.filter((e) => e.id !== id));
    reloadTrend();
    reloadCategories();
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-xl border border-border p-10 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-sm text-text-mid">
          Access restricted — evaluations are visible to admins, managers and the person themselves.
        </div>
      </div>
    );
  }

  const latestFinalized = evaluations.find((e) => e.state === 'finalized');

  return (
    <div>
      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
            Performance trend
          </div>
          <div className="flex items-center gap-2">
            <select
              value={trendBucket}
              onChange={(e) => setTrendBucket(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            >
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
            </select>
          </div>
        </div>
        <TrendChart points={trend} bucket={trendBucket} />
      </div>

      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
            Category breakdown
          </div>
          <select
            value={breakdownScope}
            onChange={(e) => setBreakdownScope(e.target.value)}
            className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
          >
            <option value="">All scopes combined</option>
            {scopeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {categories.length === 0 ? (
          <div className="text-[11px] text-text-light italic py-2">
            No finalized scores yet for this scope.
          </div>
        ) : (
          <div className="space-y-3">
            {categoriesByGrouping.map((group) => (
              <div key={group.grouping || '_'}>
                {group.grouping && (
                  <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">
                    {group.grouping}
                  </div>
                )}
                <div className="space-y-1">
                  {group.rows.map((row) => {
                    const pct = Math.max(0, Math.min(100, ((row.averageScore - 1) / 4) * 100));
                    return (
                      <div
                        key={`${group.grouping || ''}::${row.categoryName}`}
                        className="flex items-center gap-2"
                      >
                        <div className="text-xs text-text w-48 shrink-0 truncate">
                          {row.categoryName}
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-xs font-bold text-primary w-10 text-right shrink-0">
                          {row.averageScore.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-text-light w-12 text-right shrink-0">
                          n={row.evaluationCount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-text">Evaluations</div>
        {canCreate && (
          <button
            onClick={() => setShowNewModal(true)}
            className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90"
          >
            + New evaluation
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-xs text-text-light">
          Loading…
        </div>
      ) : evaluations.length === 0 ? (
        <div className="bg-white rounded-xl border border-border">
          <EmptyState icon="📊" message="No evaluations yet" />
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            const roundFinalized = group.items.filter((e) => e.state === 'finalized');
            const roundAvg =
              roundFinalized.length > 0
                ? roundFinalized.reduce(
                    (acc, e) => acc + (e.overrideFinal ?? e.computedFinal ?? 0),
                    0
                  ) / roundFinalized.length
                : null;
            return (
            <div key={group.key} className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-primary-bg flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-text">
                    Round · {formatDate(group.periodEnd)}
                  </div>
                  <div className="text-[10px] text-text-light mt-0.5">
                    {group.items.length} evaluation{group.items.length === 1 ? '' : 's'}
                  </div>
                </div>
                {roundAvg != null && (
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary leading-none">
                      {roundAvg.toFixed(1)}
                    </div>
                    <div className="text-[9px] text-text-light uppercase tracking-wider">
                      round avg
                    </div>
                  </div>
                )}
              </div>
              <div className="divide-y divide-border">
                {group.items.map((ev) => {
                  const finalNumber = ev.overrideFinal ?? ev.computedFinal;
                  const isSelected = selectedId === ev.id;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedId(isSelected ? null : ev.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left cursor-pointer border-0 ${
                        isSelected ? 'bg-primary-bg' : 'bg-white hover:bg-primary-bg/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-text truncate">
                          {ev.customerNameSnapshot}
                          {ev.projectNameSnapshot ? ` · ${ev.projectNameSnapshot}` : ''}
                        </div>
                        <div className="text-[11px] text-text-light mt-0.5">
                          {formatDate(ev.periodStart)} → {formatDate(ev.periodEnd)}
                          {ev.createdByUser ? ` · by ${ev.createdByUser.name}` : ''}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                          STATE_COLORS[ev.state] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {STATE_LABELS[ev.state] || ev.state}
                      </span>
                      {finalNumber != null && (
                        <div className="text-base font-bold text-primary leading-none shrink-0 w-10 text-right">
                          {finalNumber.toFixed(1)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {selectedDetail && (
        <div className="mt-4">
          <EvaluationDetail
            evaluation={selectedDetail}
            currentUserId={user?.id}
            onChange={handleDetailChange}
            onClose={() => setSelectedId(null)}
            onDeleted={handleDetailDeleted}
          />
        </div>
      )}

      {showNewModal && (
        <NewEvaluationModal
          resourceId={resource.id}
          onCancel={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
