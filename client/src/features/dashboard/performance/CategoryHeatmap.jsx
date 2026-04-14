import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { scoreBg, scoreColor } from '../../../lib/statusUtils';

export default function CategoryHeatmap({ filters }) {
  const [data, setData] = useState({ domains: [], categories: [], cells: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getInsightsPerformanceHeatmap(filters)
      .then((d) => {
        if (cancelled) return;
        setData(d || { domains: [], categories: [], cells: [] });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  const cellMap = new Map();
  for (const c of data.cells) {
    cellMap.set(`${c.domain}::${c.grouping ?? ''}::${c.categoryName}`, c);
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className="text-xs font-bold text-text mb-3 uppercase tracking-wider">Domain × category heatmap</div>
      {loading ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger py-6 text-center">{error}</div>
      ) : data.domains.length === 0 || data.categories.length === 0 ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">No data for this filter.</div>
      ) : (
        <div className="overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-1 px-2 text-[10px] uppercase tracking-wider text-text-light font-semibold sticky left-0 bg-white z-10">Category</th>
                {data.domains.map((d) => (
                  <th key={d} className="text-center py-1 px-2 text-[10px] uppercase tracking-wider text-text-light font-semibold">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.categories.map((cat, i) => {
                const label = cat.grouping ? `${cat.grouping} · ${cat.categoryName}` : cat.categoryName;
                return (
                  <tr key={i}>
                    <td className="py-1 px-2 text-[11px] text-text whitespace-nowrap sticky left-0 bg-white z-10">{label}</td>
                    {data.domains.map((d) => {
                      const c = cellMap.get(`${d}::${cat.grouping ?? ''}::${cat.categoryName}`);
                      if (!c) {
                        return (
                          <td key={d} className="p-1">
                            <div className="w-14 h-8 rounded bg-bg-subtle text-[10px] text-text-light flex items-center justify-center">—</div>
                          </td>
                        );
                      }
                      return (
                        <td key={d} className="p-1">
                          <div
                            className="w-14 h-8 rounded flex items-center justify-center text-[11px] font-bold"
                            style={{
                              backgroundColor: scoreBg(c.averageScore),
                              color: scoreColor(c.averageScore),
                            }}
                            title={`${d} · ${label}: ${c.averageScore.toFixed(1)} (${c.count} evals)`}
                          >
                            {c.averageScore.toFixed(1)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
