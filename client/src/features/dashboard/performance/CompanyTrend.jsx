import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import TrendChart from '../../people/tabs/performance/TrendChart';

export default function CompanyTrend({ filters }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bucket, setBucket] = useState('month');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getInsightsPerformanceTrend({ ...filters, bucket })
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
  }, [filters, bucket]);

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-bold text-text">Company trend</div>
        <div className="flex items-center gap-1">
          {['month', 'quarter'].map((b) => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`text-[11px] font-semibold rounded px-2 py-1 cursor-pointer border ${
                bucket === b
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-mid border-border hover:border-border-dark'
              }`}
            >
              {b === 'month' ? 'Month' : 'Quarter'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="text-[11px] text-text-light italic py-6 text-center">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger py-6 text-center">{error}</div>
      ) : (
        <TrendChart points={data} bucket={bucket} />
      )}
    </div>
  );
}
