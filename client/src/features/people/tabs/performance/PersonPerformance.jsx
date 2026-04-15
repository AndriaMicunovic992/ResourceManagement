import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { useOrg } from '../../../../contexts/OrgContext';
import { useData } from '../../../../contexts/DataContext';
import EmptyState from '../../../../components/ui/EmptyState';
import NewEvaluationModal from './NewEvaluationModal';
import EvaluationDetail from './EvaluationDetail';
import TrendChart, { formatBucketLabel } from './TrendChart';

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

function toDateInputValue(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthsAgoDateString(months) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  return toDateInputValue(d);
}

function currentQuarter() {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    quarter: Math.floor(now.getUTCMonth() / 3) + 1,
  };
}

function currentHalf() {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    half: now.getUTCMonth() < 6 ? 1 : 2,
  };
}

function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const from = toDateInputValue(new Date(Date.UTC(year, startMonth, 1)));
  const to = toDateInputValue(new Date(Date.UTC(year, startMonth + 3, 0)));
  return { from, to };
}

function halfRange(year, half) {
  const startMonth = half === 1 ? 0 : 6;
  const from = toDateInputValue(new Date(Date.UTC(year, startMonth, 1)));
  const to = toDateInputValue(new Date(Date.UTC(year, startMonth + 6, 0)));
  return { from, to };
}

function yearRange(year) {
  const from = toDateInputValue(new Date(Date.UTC(year, 0, 1)));
  const to = toDateInputValue(new Date(Date.UTC(year, 11, 31)));
  return { from, to };
}

function quarterOptions(count = 12) {
  // Current quarter plus the previous `count - 1` quarters.
  const { year, quarter } = currentQuarter();
  const options = [];
  let y = year;
  let q = quarter;
  for (let i = 0; i < count; i++) {
    options.push({ value: `${y}-Q${q}`, year: y, quarter: q, label: `Q${q} ${y}` });
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
  }
  return options;
}

function halfOptions(count = 8) {
  const { year, half } = currentHalf();
  const options = [];
  let y = year;
  let h = half;
  for (let i = 0; i < count; i++) {
    options.push({ value: `${y}-H${h}`, year: y, half: h, label: `H${h} ${y}` });
    h -= 1;
    if (h === 0) {
      h = 2;
      y -= 1;
    }
  }
  return options;
}

function yearOptions(count = 6) {
  const now = new Date().getUTCFullYear();
  const options = [];
  for (let i = 0; i < count; i++) {
    const y = now - i;
    options.push({ value: `${y}`, year: y, label: `${y}` });
  }
  return options;
}

/**
 * Compute a { from, to } window from the org default settings. Used by the
 * Performance tab's "Default" preset and by PersonOverview to keep both
 * views aligned.
 */
export function orgDefaultWindow(org) {
  const kind = org?.performanceTrendDefaultKind || 'rolling_months';
  if (kind === 'calendar_quarter') {
    const { year, quarter } = currentQuarter();
    return quarterRange(year, quarter);
  }
  if (kind === 'calendar_half') {
    const { year, half } = currentHalf();
    return halfRange(year, half);
  }
  if (kind === 'calendar_year') {
    return yearRange(new Date().getUTCFullYear());
  }
  if (kind === 'custom') {
    return {
      from: org?.performanceTrendDefaultFrom || '',
      to: org?.performanceTrendDefaultTo || '',
    };
  }
  const months = org?.performanceTrendDefaultMonths ?? 12;
  return { from: monthsAgoDateString(months), to: '' };
}

/**
 * Compute a { from, to } date range that covers the evaluations the trend
 * endpoint groups into `bucketStart`. Month buckets use "YYYY-MM"; quarter
 * buckets use "YYYY-QN".
 */
function bucketRange(bucketStart, bucket) {
  if (bucket === 'quarter') {
    const m = bucketStart.match(/^(\d{4})-Q([1-4])$/);
    if (!m) return null;
    return quarterRange(parseInt(m[1], 10), parseInt(m[2], 10));
  }
  const m = bucketStart.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const from = toDateInputValue(new Date(Date.UTC(y, mm - 1, 1)));
  const to = toDateInputValue(new Date(Date.UTC(y, mm, 0)));
  return { from, to };
}

export default function PersonPerformance() {
  const { resource, viewMode } = useOutletContext();
  const isSelfView = viewMode === 'self';
  const { role, currentOrg } = useOrg();
  const { user } = useAuth();
  const { meResource, customers } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = role === 'admin' || role === 'owner';
  const orgDefaultMonths = currentOrg?.performanceTrendDefaultMonths ?? 12;
  const orgDefaultKind = currentOrg?.performanceTrendDefaultKind || 'rolling_months';

  // Human label for the "Default" option based on the org's default kind.
  const orgDefaultLabel = useMemo(() => {
    if (orgDefaultKind === 'calendar_quarter') {
      const { year, quarter } = currentQuarter();
      return `Default (Q${quarter} ${year})`;
    }
    if (orgDefaultKind === 'calendar_half') {
      const { year, half } = currentHalf();
      return `Default (H${half} ${year})`;
    }
    if (orgDefaultKind === 'calendar_year') {
      return `Default (${new Date().getUTCFullYear()})`;
    }
    if (orgDefaultKind === 'custom') {
      const from = currentOrg?.performanceTrendDefaultFrom;
      const to = currentOrg?.performanceTrendDefaultTo;
      if (from && to) return `Default (${from} → ${to})`;
      if (from) return `Default (from ${from})`;
      return 'Default (custom)';
    }
    return `Default (${orgDefaultMonths}m)`;
  }, [orgDefaultKind, orgDefaultMonths, currentOrg]);

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
  const [overall, setOverall] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  // Shared scope filter (customer/project) applied to trend, overall, AND
  // category breakdown. "" = all, "c:<id>" = customer, "p:<id>" = project.
  const [scope, setScope] = useState(() => {
    // Seed from ?customerId=... so deep-links from the customer page land
    // scoped to that customer. The URL param is cleared after it's consumed.
    const customerId = searchParams.get('customerId');
    return customerId ? `c:${customerId}` : '';
  });

  useEffect(() => {
    if (searchParams.get('customerId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('customerId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Display name for the seeded customer filter banner.
  const scopedCustomerName = useMemo(() => {
    if (!scope.startsWith('c:')) return null;
    const id = scope.slice(2);
    const c = customers.find((x) => x.id === id);
    return c?.name ?? null;
  }, [scope, customers]);
  // Category breakdown for the whole window (used when no trend point is selected).
  const [categories, setCategories] = useState([]);
  // Bucket picks made by clicking data points on the trend chart. Max 2.
  const [selectedBuckets, setSelectedBuckets] = useState([]);
  // Cached category breakdown per selected bucket: { [bucketStart]: Row[] }.
  const [bucketCategories, setBucketCategories] = useState({});
  // Period window
  const [periodPreset, setPeriodPreset] = useState('default');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  // When a calendar-* preset is selected, this holds the specific period
  // (e.g., "2025-Q4", "2025-H2", "2025").
  const [calendarQuarter, setCalendarQuarter] = useState(() => {
    const { year, quarter } = currentQuarter();
    return `${year}-Q${quarter}`;
  });
  const [calendarHalf, setCalendarHalf] = useState(() => {
    const { year, half } = currentHalf();
    return `${year}-H${half}`;
  });
  const [calendarYear, setCalendarYear] = useState(
    () => `${new Date().getUTCFullYear()}`
  );

  const quarterOpts = useMemo(() => quarterOptions(12), []);
  const halfOpts = useMemo(() => halfOptions(8), []);
  const yearOpts = useMemo(() => yearOptions(6), []);

  // Resolve the period window from the preset (or custom inputs) into from/to.
  const periodWindow = useMemo(() => {
    if (periodPreset === 'all') return { from: '', to: '' };
    if (periodPreset === 'custom') return { from: periodFrom, to: periodTo };
    if (periodPreset === 'default') return orgDefaultWindow(currentOrg);
    if (periodPreset === 'calendar_quarter') {
      const m = calendarQuarter.match(/^(\d{4})-Q([1-4])$/);
      if (!m) return { from: '', to: '' };
      return quarterRange(parseInt(m[1], 10), parseInt(m[2], 10));
    }
    if (periodPreset === 'calendar_half') {
      const m = calendarHalf.match(/^(\d{4})-H([12])$/);
      if (!m) return { from: '', to: '' };
      return halfRange(parseInt(m[1], 10), parseInt(m[2], 10));
    }
    if (periodPreset === 'calendar_year') {
      const y = parseInt(calendarYear, 10);
      if (!Number.isFinite(y)) return { from: '', to: '' };
      return yearRange(y);
    }
    const monthsMap = { '3m': 3, '6m': 6, '12m': 12, '24m': 24 };
    const months = monthsMap[periodPreset] ?? orgDefaultMonths;
    return { from: monthsAgoDateString(months), to: '' };
  }, [
    periodPreset,
    periodFrom,
    periodTo,
    currentOrg,
    orgDefaultMonths,
    calendarQuarter,
    calendarHalf,
    calendarYear,
  ]);

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

  // Shared scope params applied to all performance endpoints.
  const scopeParams = useMemo(() => {
    if (scope.startsWith('c:')) return { customerId: scope.slice(2) };
    if (scope.startsWith('p:')) return { projectId: scope.slice(2) };
    return {};
  }, [scope]);

  const reloadTrend = useCallback(async () => {
    if (!canView) return;
    try {
      const data = await api.getPerformanceTrend(resource.id, {
        bucket: trendBucket,
        from: periodWindow.from,
        to: periodWindow.to,
        ...scopeParams,
      });
      setTrend(Array.isArray(data) ? data : []);
    } catch {
      setTrend([]);
    }
  }, [canView, resource.id, trendBucket, periodWindow.from, periodWindow.to, scopeParams]);

  const reloadOverall = useCallback(async () => {
    if (!canView) return;
    try {
      const data = await api.getPerformanceOverall(resource.id, {
        from: periodWindow.from,
        to: periodWindow.to,
        ...scopeParams,
      });
      setOverall(data);
    } catch {
      setOverall(null);
    }
  }, [canView, resource.id, periodWindow.from, periodWindow.to, scopeParams]);

  const reloadCategories = useCallback(async () => {
    if (!canView) return;
    const params = {
      from: periodWindow.from,
      to: periodWindow.to,
      ...scopeParams,
    };
    try {
      const data = await api.getPerformanceCategories(resource.id, params);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  }, [canView, resource.id, scopeParams, periodWindow.from, periodWindow.to]);

  useEffect(() => {
    reloadEvaluations();
  }, [reloadEvaluations]);

  useEffect(() => {
    reloadTrend();
  }, [reloadTrend]);

  useEffect(() => {
    reloadOverall();
  }, [reloadOverall]);

  useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

  // When the trend refreshes (period/bucket/scope change), drop any
  // selected buckets that no longer appear in the current trend.
  useEffect(() => {
    if (selectedBuckets.length === 0) return;
    const validKeys = new Set(trend.map((p) => p.bucketStart));
    const filtered = selectedBuckets.filter((k) => validKeys.has(k));
    if (filtered.length !== selectedBuckets.length) {
      setSelectedBuckets(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend]);

  // Load category breakdowns for each selected bucket (1 or 2). Each bucket's
  // date range maps to the month/quarter it represents.
  useEffect(() => {
    if (selectedBuckets.length === 0) {
      setBucketCategories({});
      return;
    }
    let cancelled = false;
    const next = {};
    (async () => {
      for (const key of selectedBuckets) {
        const range = bucketRange(key, trendBucket);
        if (!range) continue;
        try {
          const data = await api.getPerformanceCategories(resource.id, {
            from: range.from,
            to: range.to,
            ...scopeParams,
          });
          if (cancelled) return;
          next[key] = Array.isArray(data) ? data : [];
        } catch {
          if (cancelled) return;
          next[key] = [];
        }
      }
      if (cancelled) return;
      setBucketCategories(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBuckets, trendBucket, resource.id, scopeParams]);

  const handleTrendPointClick = useCallback((bucketStart) => {
    setSelectedBuckets((prev) => {
      if (prev.includes(bucketStart)) {
        return prev.filter((k) => k !== bucketStart);
      }
      if (prev.length >= 2) {
        // Rolling: drop the oldest click, keep the most recent + new one.
        return [prev[1], bucketStart];
      }
      return [...prev, bucketStart];
    });
  }, []);

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

  // Ordered list of selected buckets (earliest first) so a 2-bucket comparison
  // reads "earlier → later".
  const orderedSelectedBuckets = useMemo(() => {
    return [...selectedBuckets].sort((a, b) => a.localeCompare(b));
  }, [selectedBuckets]);

  // Group breakdown rows (single bucket / window) by their grouping label for
  // rendering. Chooses the right source: whole window, or the picked bucket.
  const singleBreakdownRows = useMemo(() => {
    if (orderedSelectedBuckets.length === 1) {
      return bucketCategories[orderedSelectedBuckets[0]] || [];
    }
    if (orderedSelectedBuckets.length === 0) {
      return categories;
    }
    return [];
  }, [orderedSelectedBuckets, bucketCategories, categories]);

  const singleBreakdownByGrouping = useMemo(() => {
    const map = new Map();
    for (const row of singleBreakdownRows) {
      const key = row.grouping || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return Array.from(map.entries()).map(([grouping, rows]) => ({ grouping, rows }));
  }, [singleBreakdownRows]);

  // When exactly two buckets are selected, join their category rows by
  // (grouping, categoryName) and compute per-category deltas.
  const comparisonRows = useMemo(() => {
    if (orderedSelectedBuckets.length !== 2) return [];
    const [aKey, bKey] = orderedSelectedBuckets;
    const a = bucketCategories[aKey] || [];
    const b = bucketCategories[bKey] || [];
    const keyFor = (r) => `${r.grouping || ''}::${r.categoryName}`;
    const map = new Map();
    for (const r of a) {
      map.set(keyFor(r), {
        grouping: r.grouping || null,
        categoryName: r.categoryName,
        earlier: r.averageScore,
        later: null,
      });
    }
    for (const r of b) {
      const k = keyFor(r);
      const existing = map.get(k);
      if (existing) existing.later = r.averageScore;
      else {
        map.set(k, {
          grouping: r.grouping || null,
          categoryName: r.categoryName,
          earlier: null,
          later: r.averageScore,
        });
      }
    }
    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      delta:
        r.earlier == null || r.later == null
          ? null
          : Math.round((r.later - r.earlier) * 10) / 10,
    }));
    rows.sort((x, y) => {
      const gx = x.grouping || '';
      const gy = y.grouping || '';
      if (gx !== gy) return gx.localeCompare(gy);
      return x.categoryName.localeCompare(y.categoryName);
    });
    return rows;
  }, [orderedSelectedBuckets, bucketCategories]);

  const comparisonByGrouping = useMemo(() => {
    const map = new Map();
    for (const row of comparisonRows) {
      const key = row.grouping || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return Array.from(map.entries()).map(([grouping, rows]) => ({ grouping, rows }));
  }, [comparisonRows]);

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
      reloadOverall();
      reloadCategories();
    }
  };

  const handleDetailDeleted = async (id) => {
    setSelectedId(null);
    setSelectedDetail(null);
    setEvaluations((prev) => prev.filter((e) => e.id !== id));
    reloadTrend();
    reloadOverall();
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

  const overallValue = overall?.overall;
  const overallCount = overall?.evaluations?.length ?? 0;
  const comparisonMode = orderedSelectedBuckets.length === 2;
  const singleBucketMode = orderedSelectedBuckets.length === 1;

  return (
    <div>
      {scopedCustomerName && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <div className="text-[12px] text-text-mid">
            Filtered to customer:{' '}
            <span className="font-semibold text-text">{scopedCustomerName}</span>
          </div>
          <button
            onClick={() => setScope('')}
            className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
          >
            Clear
          </button>
        </div>
      )}
      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
              Performance
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <div className="text-2xl font-bold text-primary leading-none">
                {overallValue != null ? overallValue.toFixed(1) : '—'}
              </div>
              <div className="text-[10px] text-text-light">
                {overallValue != null
                  ? `overall · ${overallCount} eval${overallCount === 1 ? '' : 's'} in window`
                  : 'no finalized evaluations in window'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
              title="Customer / project scope"
            >
              <option value="">All scopes combined</option>
              {scopeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
              title="Period window"
            >
              <option value="default">{orgDefaultLabel}</option>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
              <option value="24m">Last 24 months</option>
              <option value="calendar_quarter">Calendar quarter…</option>
              <option value="calendar_half">Calendar half-year…</option>
              <option value="calendar_year">Calendar year…</option>
              <option value="all">All time</option>
              <option value="custom">Custom…</option>
            </select>
            {periodPreset === 'calendar_quarter' && (
              <select
                value={calendarQuarter}
                onChange={(e) => setCalendarQuarter(e.target.value)}
                className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
              >
                {quarterOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {periodPreset === 'calendar_half' && (
              <select
                value={calendarHalf}
                onChange={(e) => setCalendarHalf(e.target.value)}
                className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
              >
                {halfOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {periodPreset === 'calendar_year' && (
              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(e.target.value)}
                className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
              >
                {yearOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
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
        {periodPreset === 'custom' && (
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[10px] font-semibold text-text-mid">From</label>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
            />
            <label className="text-[10px] font-semibold text-text-mid">To</label>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="px-2 py-1 border border-border rounded text-xs text-text outline-none focus:border-primary"
            />
          </div>
        )}
        <TrendChart
          points={trend}
          bucket={trendBucket}
          selectedBuckets={selectedBuckets}
          onPointClick={handleTrendPointClick}
        />
        {selectedBuckets.length > 0 && (
          <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-text-light">
            <div>
              {comparisonMode
                ? `Comparing ${formatBucketLabel(orderedSelectedBuckets[0], trendBucket)} → ${formatBucketLabel(orderedSelectedBuckets[1], trendBucket)}`
                : `Showing ${formatBucketLabel(orderedSelectedBuckets[0], trendBucket)} only`}
              {' · click another point to '}
              {comparisonMode ? 'replace' : 'compare'}
            </div>
            <button
              onClick={() => setSelectedBuckets([])}
              className="text-[11px] text-primary hover:underline cursor-pointer border-0 bg-transparent p-0"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {!isSelfView && (
      <>
      <div className="bg-white rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold">
              Category breakdown
            </div>
            <div className="text-[11px] text-text-light mt-0.5">
              {comparisonMode
                ? `Comparing ${formatBucketLabel(orderedSelectedBuckets[0], trendBucket)} → ${formatBucketLabel(orderedSelectedBuckets[1], trendBucket)}`
                : singleBucketMode
                ? `${formatBucketLabel(orderedSelectedBuckets[0], trendBucket)} only`
                : 'Average across the selected window'}
            </div>
          </div>
        </div>

        {comparisonMode ? (
          comparisonRows.length === 0 ? (
            <div className="text-[11px] text-text-light italic py-2">
              No category scores in common between these two points.
            </div>
          ) : (
            <div className="space-y-3">
              {comparisonByGrouping.map((group) => (
                <div key={group.grouping || '_'}>
                  {group.grouping && (
                    <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">
                      {group.grouping}
                    </div>
                  )}
                  <div className="space-y-1">
                    {group.rows.map((row) => {
                      const earlierPct =
                        row.earlier == null
                          ? 0
                          : Math.max(0, Math.min(100, ((row.earlier - 1) / 4) * 100));
                      const laterPct =
                        row.later == null
                          ? 0
                          : Math.max(0, Math.min(100, ((row.later - 1) / 4) * 100));
                      const deltaColor =
                        row.delta == null
                          ? 'text-text-light'
                          : row.delta > 0
                          ? 'text-emerald-600'
                          : row.delta < 0
                          ? 'text-danger'
                          : 'text-text-light';
                      const deltaLabel =
                        row.delta == null
                          ? '—'
                          : row.delta > 0
                          ? `+${row.delta.toFixed(1)}`
                          : row.delta.toFixed(1);
                      return (
                        <div
                          key={`${group.grouping || ''}::${row.categoryName}`}
                          className="flex items-center gap-2"
                        >
                          <div className="text-xs text-text w-48 shrink-0 truncate">
                            {row.categoryName}
                          </div>
                          <div className="flex-1 flex flex-col gap-0.5">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gray-400 rounded-full"
                                style={{ width: `${earlierPct}%` }}
                              />
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${laterPct}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-[10px] text-text-light w-10 text-right shrink-0">
                            {row.earlier == null ? '—' : row.earlier.toFixed(1)}
                          </div>
                          <div className="text-xs font-bold text-primary w-10 text-right shrink-0">
                            {row.later == null ? '—' : row.later.toFixed(1)}
                          </div>
                          <div
                            className={`text-[11px] font-semibold w-10 text-right shrink-0 ${deltaColor}`}
                          >
                            {deltaLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : singleBreakdownRows.length === 0 ? (
          <div className="text-[11px] text-text-light italic py-2">
            {singleBucketMode
              ? 'No finalized scores for the selected point.'
              : 'No finalized scores yet for this window.'}
          </div>
        ) : (
          <div className="space-y-3">
            {singleBreakdownByGrouping.map((group) => (
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
                    <div key={ev.id}>
                      <button
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
                      {isSelected && selectedDetail && selectedDetail.id === ev.id && (
                        <div className="border-t border-border bg-primary-bg/30 p-4">
                          <EvaluationDetail
                            evaluation={selectedDetail}
                            currentUserId={user?.id}
                            onChange={handleDetailChange}
                            onClose={() => setSelectedId(null)}
                            onDeleted={handleDetailDeleted}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {!isSelfView && showNewModal && (
        <NewEvaluationModal
          resourceId={resource.id}
          onCancel={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
