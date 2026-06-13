import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { scoreBg, scoreColor } from '../../../lib/statusUtils';

export default function PeopleScoreList({ filters }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getInsightsPerformancePeople(filters)
      .then((d) => {
        if (cancelled) return;
        setData(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="text-[13px] font-bold text-text mb-3">People ranked by mean score</div>
      {loading ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger py-6 text-center">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">No people match this filter yet.</div>
      ) : (
        <div className="space-y-1">
          {data.map((p) => (
            <Link
              key={p.resourceId}
              to={`/people/${p.resourceId}/performance`}
              className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#F7FAFC] no-underline"
            >
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: scoreBg(p.meanOverall),
                  color: scoreColor(p.meanOverall),
                }}
              >
                {p.meanOverall.toFixed(1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text truncate">{p.name}</div>
                <div className="text-[10px] text-text-light truncate">
                  {p.domains.length > 0 ? p.domains.join(', ') : '—'}
                  {p.teamNames.length > 0 && ` · ${p.teamNames.join(', ')}`}
                </div>
              </div>
              <div className="text-[10px] text-text-light shrink-0">n={p.evaluationCount}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
