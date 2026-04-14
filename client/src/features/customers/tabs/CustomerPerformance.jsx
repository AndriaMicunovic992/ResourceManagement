import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../../lib/api';
import { scoreColor, scoreBg } from '../../../lib/statusUtils';
import { addMonths, currentMonth } from '../../../lib/dateUtils';

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

function TrendSvg({ points }) {
  const valid = points.filter((p) => p.overall != null);
  if (valid.length < 2) {
    return <div className="text-xs text-text-light">Not enough data for a trend.</div>;
  }
  const width = 640;
  const height = 160;
  const padLeft = 32;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const minY = 1;
  const maxY = 5;
  const stepX = valid.length === 1 ? 0 : plotW / (valid.length - 1);

  const toX = (i) => padLeft + i * stepX;
  const toY = (v) => padTop + plotH - ((v - minY) / (maxY - minY)) * plotH;

  const path = valid
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.overall).toFixed(1)}`)
    .join(' ');

  const yLabels = [1, 2, 3, 4, 5];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[160px]">
      {yLabels.map((v) => (
        <g key={v}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={toY(v)}
            y2={toY(v)}
            stroke="#e5e7eb"
            strokeDasharray="2 3"
          />
          <text
            x={padLeft - 6}
            y={toY(v) + 3}
            fontSize="9"
            fill="#9ca3af"
            textAnchor="end"
          >
            {v}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2" />
      {valid.map((p, i) => (
        <circle
          key={p.bucketStart}
          cx={toX(i)}
          cy={toY(p.overall)}
          r="3"
          fill="#6366f1"
        >
          <title>{`${p.bucketStart}: ${p.overall.toFixed(1)} (${p.evaluationCount} eval)`}</title>
        </circle>
      ))}
      {valid.map((p, i) => {
        if (valid.length > 8 && i % 2 === 1) return null;
        return (
          <text
            key={`lbl-${p.bucketStart}`}
            x={toX(i)}
            y={height - 6}
            fontSize="9"
            fill="#6b7280"
            textAnchor="middle"
          >
            {p.bucketStart}
          </text>
        );
      })}
    </svg>
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
        <div className="flex items-center gap-1 p-1 bg-bg-subtle rounded-lg border border-border">
          {PRESETS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPreset(opt.key)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer border transition ${
                preset === opt.key
                  ? 'bg-white text-primary border-border shadow-sm'
                  : 'bg-transparent text-text-mid border-transparent hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 bg-bg-subtle rounded-lg border border-border">
          {[
            { key: 'month', label: 'Monthly' },
            { key: 'quarter', label: 'Quarterly' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setBucket(opt.key)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer border transition ${
                bucket === opt.key
                  ? 'bg-white text-primary border-border shadow-sm'
                  : 'bg-transparent text-text-mid border-transparent hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-text-light py-8">Loading…</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-border shadow-card p-5">
            <div className="flex items-start gap-6 flex-wrap">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-light font-semibold">
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
                <TrendSvg points={trend} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-xs font-semibold text-text-mid uppercase tracking-wider">
              Per-person breakdown
            </div>
            {perPerson.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-light">
                No finalized evaluations in this window.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-bg-subtle">
                  <tr className="text-left text-[11px] text-text-mid uppercase tracking-wider">
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
