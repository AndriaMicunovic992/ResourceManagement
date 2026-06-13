import { useId, useMemo, useState } from 'react';

/**
 * Shared line-chart treatment, matching the Home dashboard utilization chart:
 * smooth Catmull-Rom curve, soft gradient area fill, faint gridlines, and a
 * dark hover tooltip with a ringed marker. Used by every trend/score chart so
 * they all look the same.
 *
 * Coordinate trick: the viewBox is `0 0 100 H` (H = rendered px height) drawn
 * with preserveAspectRatio="none". That stretches X to the container width
 * (curves/areas tolerate this) while leaving Y at 1:1 — so HTML overlays
 * (marker, tooltip, labels) can position by left-% / top-px without the dots
 * or text ever distorting.
 */

// Catmull-Rom → cubic bezier.
function smoothPath(pts) {
  if (pts.length < 2) return pts.length === 1 ? `M${pts[0][0]} ${pts[0][1]}` : '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]},${c2[0]} ${c2[1]},${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Compact, axis-less smooth area line for KPI cards / inline accents. */
export function Sparkline({ data, color = '#4CBAD4', height = 40, className = '' }) {
  const vals = (data || [])
    .map((d) => (typeof d === 'number' ? d : d?.value ?? d?.overall))
    .filter((v) => v != null);
  if (vals.length < 2) return null;
  const W = 100;
  const H = height;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => [
    (i / (vals.length - 1)) * W,
    4 + (1 - (v - min) / span) * (H - 8),
  ]);
  const line = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height }}>
      <path d={`${line} L${W} ${H} L0 ${H}Z`} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function LineChart({
  data,
  height = 168,
  color = '#4CBAD4',
  domain,
  yTicks,
  area = true,
  smooth = true,
  valueFormat = (v) => v,
  seriesName = 'Value',
  pointColor,
  trendLine = false,
  selectable = false,
  selectedIndices = [],
  onPointClick,
  emptyLabel = 'No data yet.',
  xLabels = true,
}) {
  const gid = useId().replace(/:/g, '');
  const points = data || [];
  const validIdx = points.map((p, i) => (p.value != null ? i : -1)).filter((i) => i >= 0);
  const [hover, setHover] = useState(null);

  const padTop = 12;
  const padBottom = 12;
  const H = height;
  const plotH = H - padTop - padBottom;
  const n = points.length;

  const [lo, hi] = useMemo(() => {
    if (domain) return domain;
    const vals = validIdx.map((i) => points[i].value);
    if (vals.length === 0) return [0, 1];
    let mn = Math.min(...vals);
    let mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.12;
    return [mn - pad, mx + pad];
  }, [domain, validIdx, points]);

  const xOf = (i) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const yOf = (v) => padTop + (1 - (v - lo) / (hi - lo)) * plotH;

  const ticks = useMemo(() => {
    if (yTicks) return yTicks;
    return [0.25, 0.5, 0.75].map((f) => lo + (hi - lo) * f);
  }, [yTicks, lo, hi]);

  const linePts = validIdx.map((i) => [xOf(i), yOf(points[i].value)]);
  const linePath = smooth ? smoothPath(linePts) : linePts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const areaPath = linePts.length >= 2 ? `${linePath} L${xOf(validIdx[validIdx.length - 1])} ${H} L${xOf(validIdx[0])} ${H}Z` : '';

  // Least-squares trend across rated points.
  const trend = useMemo(() => {
    if (!trendLine || validIdx.length < 2) return null;
    const xs = validIdx;
    const ys = validIdx.map((i) => points[i].value);
    const m = xs.length;
    const sx = xs.reduce((s, x) => s + x, 0);
    const sy = ys.reduce((s, y) => s + y, 0);
    const sxx = xs.reduce((s, x) => s + x * x, 0);
    const sxy = xs.reduce((s, x, k) => s + x * ys[k], 0);
    const denom = m * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (m * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / m;
    const clamp = (v) => Math.max(lo, Math.min(hi, v));
    const i0 = xs[0];
    const i1 = xs[xs.length - 1];
    return { x1: xOf(i0), y1: yOf(clamp(slope * i0 + intercept)), x2: xOf(i1), y2: yOf(clamp(slope * i1 + intercept)) };
  }, [trendLine, validIdx, points, lo, hi]);

  if (validIdx.length === 0) {
    return <div className="text-xs text-text-light py-6 text-center">{emptyLabel}</div>;
  }

  const active = hover != null && points[hover]?.value != null
    ? hover
    : validIdx[validIdx.length - 1];
  const activePoint = points[active];
  const leftPct = xOf(active);
  const yActive = yOf(activePoint.value);
  const dotColor = pointColor ? pointColor(activePoint.value) : color;

  const handleMove = (e) => {
    if (n <= 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div>
      <div className="relative" style={{ height: H }}>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
          <defs>
            <linearGradient id={`lc-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <line key={i} x1="0" y1={yOf(t)} x2="100" y2={yOf(t)} stroke="#EDF2F7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {area && areaPath && <path d={areaPath} fill={`url(#lc-${gid})`} />}
          {trend && (
            <line x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2} stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.75" vectorEffect="non-scaling-stroke" />
          )}
          {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
        </svg>

        {/* hover guide (only while hovering — at rest the tooltip would cover the plot) */}
        {hover != null && (
          <div className="absolute pointer-events-none" style={{ left: `${leftPct}%`, top: yActive, bottom: 0, width: 0, borderLeft: '1px dashed', borderColor: `${color}66`, transform: 'translateX(-0.5px)' }} />
        )}

        {/* persistent selected markers (comparison mode) */}
        {selectable && selectedIndices.map((i) => (
          points[i]?.value == null ? null : (
            <span key={i} className="absolute pointer-events-none rounded-full" style={{ left: `${xOf(i)}%`, top: yOf(points[i].value), width: 11, height: 11, background: color, border: '2px solid #fff', boxShadow: `0 0 0 2px ${color}80`, transform: 'translate(-50%,-50%)' }} />
          )
        ))}

        {/* marker dot — at rest sits on the latest point, follows the cursor on hover */}
        <span className="absolute pointer-events-none rounded-full" style={{ left: `${leftPct}%`, top: yActive, width: 10, height: 10, background: dotColor, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transform: 'translate(-50%,-50%)' }} />

        {/* dark tooltip — hover only */}
        {hover != null && (
          <div
            className="absolute pointer-events-none bg-[#16323C] text-white rounded-xl px-3 py-2 shadow-lg z-10"
            style={{ left: `clamp(4px, calc(${leftPct}% - 68px), calc(100% - 140px))`, top: Math.max(2, yActive - 52), width: 136 }}
          >
            <b className="text-[10.5px]">{activePoint.label}</b>
            <div className="flex items-center gap-1.5 text-[10px] opacity-95 mt-1">
              <i className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
              {seriesName}
              <b className="ml-auto">{valueFormat(activePoint.value)}</b>
            </div>
            {activePoint.sub && <div className="text-[9px] opacity-70 mt-0.5">{activePoint.sub}</div>}
          </div>
        )}

        {/* mouse capture */}
        <div
          className="absolute inset-0"
          style={{ cursor: selectable ? 'pointer' : 'default' }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={selectable && onPointClick ? () => onPointClick(active) : undefined}
        />
      </div>

      {xLabels && (
        <div className="relative mt-1 h-3.5 text-[9.5px] font-mono text-text-light">
          {points.map((p, i) => {
            // Thin labels when crowded; always keep first + last. Positioned by
            // x-fraction so they stay under their points even when thinned.
            const stride = n > 8 ? Math.ceil(n / 6) : 1;
            if (i % stride !== 0 && i !== n - 1) return null;
            const edge = i === 0 ? 'translateX(0)' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)';
            return (
              <span
                key={i}
                className={`absolute whitespace-nowrap ${i === active ? 'text-primary font-bold' : ''}`}
                style={{ left: `${xOf(i)}%`, transform: edge }}
              >
                {p.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
