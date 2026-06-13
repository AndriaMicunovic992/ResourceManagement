import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { scoreColor } from '../../../lib/statusUtils';

export default function CategoryAverages({ filters }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getInsightsPerformanceCategories(filters)
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
      <div className="text-[13px] font-bold text-text mb-3">Category averages</div>
      {loading ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger py-6 text-center">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">No data for this filter.</div>
      ) : (
        <div className="space-y-1.5">
          {data.map((row, i) => {
            const label = row.grouping ? `${row.grouping} · ${row.categoryName}` : row.categoryName;
            const widthPct = ((row.averageScore - 1) / 4) * 100;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="w-40 text-[11px] text-text truncate" title={label}>{label}</div>
                <div className="flex-1 h-5 bg-[#EEF1F5] rounded relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 bottom-0 rounded"
                    style={{ width: `${widthPct}%`, backgroundColor: scoreColor(row.averageScore) }}
                  />
                </div>
                <div className="w-10 text-right text-[11px] font-bold text-text">{row.averageScore.toFixed(1)}</div>
                <div className="w-8 text-right text-[10px] text-text-light">n={row.evaluationCount}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
