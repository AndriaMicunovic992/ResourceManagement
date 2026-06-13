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
    <div className="bg-white rounded-2xl border border-border-light shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-bold text-text">Company trend</div>
        <span className="flex bg-[#EEF1F5] rounded-[11px] p-[3px]">
          {['month', 'quarter'].map((b) => (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`text-[10.5px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                bucket === b
                  ? 'bg-white text-primary shadow-[0_1px_4px_rgba(34,49,63,0.12)]'
                  : 'text-text-mid hover:text-text'
              }`}
            >
              {b === 'month' ? 'Month' : 'Quarter'}
            </button>
          ))}
        </span>
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
