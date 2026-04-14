import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { scoreColor } from '../../../lib/statusUtils';
import PerformanceFilters from './PerformanceFilters';
import ScoreDistribution from './ScoreDistribution';
import CategoryAverages from './CategoryAverages';
import CategoryHeatmap from './CategoryHeatmap';
import CompanyTrend from './CompanyTrend';
import PeopleScoreList from './PeopleScoreList';

export default function PerformanceSegment() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    teamId: '',
    domain: '',
    role: '',
    seniority: '',
  });

  // Stabilize filters for child effect deps.
  const filterParams = useMemo(() => ({ ...filters }), [
    filters.from,
    filters.to,
    filters.teamId,
    filters.domain,
    filters.role,
    filters.seniority,
  ]);

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getInsightsPerformanceSummary(filterParams)
      .then((d) => {
        if (cancelled) return;
        setSummary(d);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load summary');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filterParams]);

  return (
    <div>
      <PerformanceFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <SummaryCard
          label="People included"
          value={loading ? '…' : summary ? String(summary.peopleIncluded) : '0'}
        />
        <SummaryCard
          label="Evaluations included"
          value={loading ? '…' : summary ? String(summary.evaluationsIncluded) : '0'}
        />
        <SummaryCard
          label="Mean overall"
          value={loading ? '…' : summary && summary.meanOverall != null ? summary.meanOverall.toFixed(1) : '—'}
          color={summary && summary.meanOverall != null ? scoreColor(summary.meanOverall) : undefined}
        />
      </div>
      {error && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <ScoreDistribution filters={filterParams} />
        <CategoryAverages filters={filterParams} />
      </div>
      <div className="mb-3">
        <CompanyTrend filters={filterParams} />
      </div>
      <div className="mb-3">
        <CategoryHeatmap filters={filterParams} />
      </div>
      <PeopleScoreList filters={filterParams} />
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: color ?? 'var(--color-text, #111)' }}>{value}</div>
    </div>
  );
}
