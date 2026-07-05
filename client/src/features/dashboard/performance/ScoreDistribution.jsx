import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { scoreColor } from '../../../lib/statusUtils';
import InfoDot from '../../../components/ui/InfoDot';

export default function ScoreDistribution({ filters }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getInsightsPerformanceDistribution(filters)
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

  const maxCount = data.reduce((m, b) => Math.max(m, b.count), 0);

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="text-[13px] font-bold text-text mb-3">
        Score distribution{' '}
        <InfoDot text="Counts of finalized evaluations by final-score band — eight 0.5-wide buckets from 1.0 to 5.0 — for the current filters." />
      </div>
      {loading ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger py-6 text-center">{error}</div>
      ) : maxCount === 0 ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">No finalized evaluations for this filter.</div>
      ) : (
        <div className="flex items-end justify-between gap-2 h-[160px]">
          {data.map((b) => {
            const heightPct = (b.count / maxCount) * 100;
            const midpoint = (b.lower + b.upper) / 2;
            return (
              <div key={b.bucket} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <div className="text-[10px] font-semibold text-text">{b.count || ''}</div>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: scoreColor(midpoint),
                    minHeight: b.count > 0 ? '2px' : '0',
                  }}
                />
                <div className="text-[9px] text-text-light whitespace-nowrap">{b.bucket}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
