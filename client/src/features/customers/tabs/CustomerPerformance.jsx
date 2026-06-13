import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../../lib/api';
import { scoreColor, scoreBg } from '../../../lib/statusUtils';
import { addMonths, currentMonth } from '../../../lib/dateUtils';
import LineChart from '../../../components/ui/LineChart';
import { formatBucketLabel } from '../../people/tabs/performance/TrendChart';

const PRESETS = [
  { key: '3m', label: 'Last 3m' },
  { key: '6m', label: 'Last 6m' },
  { key: '12m', label: 'Last 12m' },
  { key: '24m', label: 'Last 24m' },
  { key: 'all', label: 'All time' },
];

function presetWindow(key) {
  if (key === 'all') return { from: '', to: '' };
  const monthsMap = { '3m': 3, '6m': 6, '12m': 12, '24m': 24 };
  const n = monthsMap[key] ?? 12;
  const start = addMonths(currentMonth(), -(n - 1));
  return { from: `${start}-01`, to: '' };
}

function TrendSvg({ points, bucket }) {
  const valid = points.filter((p) => p.overall != null);
  if (valid.length < 2) {
    return <div className="text-xs text-text-light">Not enough data for a trend.</div>;
  }
  return (
    <LineChart
      data={points.map((p) => ({
        label: formatBucketLabel(p.bucketStart, bucket),
        value: p.overall == null ? null : p.overall,
        sub: p.overall == null ? null : `${p.evaluationCount} eval${p.evaluationCount === 1 ? '' : 's'}`,
      }))}
      height={160}
      color="#6366f1"
      domain={[1, 5]}
      yTicks={[1, 2, 3, 4, 5]}
      seriesName="Overall"
      valueFormat={(v) => v.toFixed(1)}
    />
  );
}

export default function CustomerPerformance() {
  const { customer } = useOutletContext();
  const navigate = useNavigate();
  const [preset, setPreset] = useState('12m');
  const [bucket, setBucket] = useState('month');
  const [overall, setOverall] = useState(null);
  const [trend, setTrend] = useState([]);
  const [perPerson, setPerPerson] = useState([]);
  const [loading, setLoading] = useState(true);

  const window = useMemo(() => presetWindow(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { from: window.from, to: window.to };
    Promise.all([
      api.getCustomerPerformanceOverall(customer.id, params).catch(() => null),
      api
        .getCustomerPerformanceTrend(customer.id, { ...params, bucket })
        .catch(() => []),
      api.getCustomerPerformancePerPerson(customer.id, params).catch(() => []),
    ]).then(([o, t, pp]) => {
      if (cancelled) return;
      setOverall(o);
      setTrend(Array.isArray(t) ? t : []);
      setPerPerson(Array.isArray(pp) ? pp : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [customer.id, window.from, window.to, bucket]);

  const overallValue = overall?.overall;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex bg-[#EEF1F5] rounded-[11px] p-[3px]">
          {PRESETS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPreset(opt.key)}
              className={`text-[10.5px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                preset === opt.key
                  ? 'bg-white text-primary shadow-[0_1px_4px_rgba(34,49,63,0.12)]'
                  : 'text-text-mid hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </span>
        <span className="flex bg-[#EEF1F5] rounded-[11px] p-[3px]">
          {[
            { key: 'month', label: 'Monthly' },
            { key: 'quarter', label: 'Quarterly' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setBucket(opt.key)}
              className={`text-[10.5px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                bucket === opt.key
                  ? 'bg-white text-primary shadow-[0_1px_4px_rgba(34,49,63,0.12)]'
                  : 'text-text-mid hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </span>
      </div>

      {loading ? (
        <div className="text-center text-sm text-text-light py-8">Loading…</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-border-light shadow-card p-5">
            <div className="flex items-start gap-6 flex-wrap">
              <div>
                <div className="text-[13px] font-bold text-text">
                  Overall (FTE-weighted)
                </div>
                <div
                  className="text-5xl font-bold font-mono mt-1"
                  style={{ color: overallValue != null ? scoreColor(overallValue) : '#9ca3af' }}
                >
                  {overallValue != null ? overallValue.toFixed(1) : '—'}
                </div>
                <div className="text-[11px] text-text-light mt-1">
                  {overall?.evaluationsIncluded ?? 0} eval
                  {overall?.evaluationsIncluded === 1 ? '' : 's'} ·{' '}
                  {overall?.peopleIncluded ?? 0} {overall?.peopleIncluded === 1 ? 'person' : 'people'}
                </div>
              </div>
              <div className="flex-1 min-w-[320px]">
                <TrendSvg points={trend} bucket={bucket} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border-light shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-[13px] font-bold text-text">
              Per-person breakdown
            </div>
            {perPerson.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-light">
                No finalized evaluations in this window.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#F7FAFC]">
                  <tr className="text-left text-[9.5px] text-text-light uppercase tracking-wider">
                    <th className="px-4 py-2 font-semibold">Person</th>
                    <th className="px-4 py-2 font-semibold text-right">Evaluations</th>
                    <th className="px-4 py-2 font-semibold text-right">Allocation share</th>
                    <th className="px-4 py-2 font-semibold text-right">Mean overall</th>
                    <th className="px-4 py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {perPerson.map((row) => (
                    <tr key={row.resourceId} className="border-t border-border">
                      <td className="px-4 py-2 font-semibold text-text">{row.name}</td>
                      <td className="px-4 py-2 font-mono text-right text-text-mid">
                        {row.evaluationCount}
                      </td>
                      <td className="px-4 py-2 font-mono text-right text-text-mid">
                        {row.totalAllocationShare.toFixed(1)}
                      </td>
                      <td className="px-4 py-2 font-mono text-right">
                        <span
                          className="inline-block rounded px-2 py-0.5"
                          style={{
                            color: scoreColor(row.meanOverall),
                            backgroundColor: scoreBg(row.meanOverall),
                          }}
                        >
                          {row.meanOverall.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() =>
                            navigate(
                              `/people/${row.resourceId}/performance?customerId=${customer.id}`
                            )
                          }
                          className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
                        >
                          View ›
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
