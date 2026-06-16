import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useVisibility } from '../../contexts/VisibilityContext';
import { useData } from '../../contexts/DataContext';
import { useComputed } from '../../hooks/useComputed';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';
import { MONTHS, SENIORITY_SHORT } from '../../lib/constants';
import { currentMonth, addMonths, monthRange, formatMonth } from '../../lib/dateUtils';
import { firstName, resourcePrimaryDomain, domainColor } from '../../lib/resourceUtils';
import { utilColor, utilBg, scoreColor, scoreBg } from '../../lib/statusUtils';
import NotificationBell from './NotificationBell';

/* ---------- svg helpers ---------- */

// Catmull-Rom → cubic bezier for the smooth "logip" curves.
function smoothPath(pts) {
  if (pts.length < 2) return '';
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

function Spark({ values, color, id }) {
  const W = 200, H = 34;
  const max = Math.max(...values, 0.001);
  const pts = values.map((v, i) => [
    (i / Math.max(values.length - 1, 1)) * W,
    H - 6 - (v / max) * (H - 12),
  ]);
  const line = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute left-0 right-0 bottom-0 w-full h-[34px]">
      <path d={`${line} L${W} ${H} L0 ${H}Z`} fill={color} opacity="0.1" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function Delta({ value, suffix = '', goodWhenDown = false }) {
  if (value == null || Math.abs(value) < 0.005) return null;
  const up = value > 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md align-middle ml-1.5 ${
        good ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
      }`}
    >
      {up ? '▲' : '▼'} {up ? '+' : ''}{Math.round(value * 10) / 10}{suffix}
    </span>
  );
}

/* ---------- KPI card ---------- */

function Kpi({ label, chip, chipBg, chipColor, children, spark, sparkColor, donut }) {
  return (
    <div className="relative overflow-hidden bg-white border border-border-light rounded-2xl px-4 pt-3.5 pb-9 shadow-card">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-text-mid">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px]" style={{ background: chipBg, color: chipColor }}>
          {chip}
        </span>
        {label}
      </div>
      <div className="mt-2 text-[22px] font-extrabold tracking-tight text-text leading-none">{children}</div>
      {spark && <Spark values={spark} color={sparkColor} />}
      {donut}
    </div>
  );
}

/* ---------- right-rail list (people / customers share one structure) ---------- */

function RailSection({ title, linkTo, linkLabel, children }) {
  return (
    <div>
      <div className="flex items-baseline mb-1.5 px-1">
        <h4 className="text-xs font-bold text-text m-0">{title}</h4>
        <span className="flex-1" />
        {linkTo && (
          <Link to={linkTo} className="text-[10px] font-semibold text-primary no-underline hover:underline">{linkLabel}</Link>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function RailRow({ to, avatar, title, meta, chip, hot }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 py-2 px-2 -mx-1 rounded-xl no-underline transition ${
        hot ? 'bg-white shadow-[0_4px_14px_rgba(34,49,63,0.08)]' : 'hover:bg-white/70'
      }`}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-text truncate">{title}</span>
        <span className="block text-[9.5px] font-mono text-text-light truncate">{meta}</span>
      </span>
      {chip}
    </Link>
  );
}

/* ---------- main ---------- */

export default function HomeDashboard() {
  const { user } = useAuth();
  const { managedPersonIds } = useVisibility();
  const { customers, projects, resources, needs, assignments } = useData();
  const { rU, rURealised } = useComputed();
  const navigate = useNavigate();

  const [evals, setEvals] = useState(null);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    let dead = false;
    api.listEvaluations().then((d) => { if (!dead) setEvals(Array.isArray(d) ? d : []); }).catch(() => { if (!dead) setEvals([]); });
    api.getMyReminders().then((d) => { if (!dead) setReminders(Array.isArray(d) ? d : []); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const m0 = currentMonth();
  const year = m0.slice(0, 4);
  const windowMonths = useMemo(() => monthRange(`${year}-01`, `${year}-12`), [year]);
  const m0idx = windowMonths.indexOf(m0);

  /* ----- per-month series over the year ----- */
  const series = useMemo(() => {
    const capacity = resources.reduce((s, r) => s + (r.capacity || 1), 0) || 1;
    const realisedPct = [], plannedPct = [], gapFte = [], activeCount = [];
    const projectById = new Map(projects.map((p) => [p.id, p]));

    for (const m of windowMonths) {
      let realised = 0, planned = 0;
      for (const r of resources) {
        realised += rURealised[r.id]?.[m] || 0;
        planned += rU[r.id]?.[m] || 0;
      }
      realisedPct.push((realised / capacity) * 100);
      plannedPct.push((planned / capacity) * 100);

      let gap = 0;
      const active = new Set();
      for (const n of needs) {
        const needed = (n.monthAllocations || {})[m] || 0;
        if (needed > 0) active.add(n.projectId);
        if (needed <= 0) continue;
        const filled = assignments
          .filter((a) => a.needId === n.id)
          .reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        gap += Math.max(0, needed - filled);
      }
      gapFte.push(gap);
      activeCount.push([...active].filter((id) => projectById.get(id)?.status === 'realised').length);
    }
    return { realisedPct, plannedPct, gapFte, activeCount, capacity };
  }, [windowMonths, resources, needs, assignments, projects, rU, rURealised]);

  /* ----- headline insight ----- */
  const insight = useMemo(() => {
    let gap = 0; const openCustomers = new Set(); let openNeeds = 0;
    const projectById = new Map(projects.map((p) => [p.id, p]));
    for (const n of needs) {
      const needed = (n.monthAllocations || {})[m0] || 0;
      if (needed <= 0) continue;
      const filled = assignments.filter((a) => a.needId === n.id).reduce((s, a) => s + ((a.monthAllocations || {})[m0] || 0), 0);
      const g = needed - filled;
      if (g > 0.005) {
        gap += g; openNeeds += 1;
        const cid = projectById.get(n.projectId)?.customerId;
        if (cid) openCustomers.add(cid);
      }
    }
    return { gap, openNeeds, customers: openCustomers.size };
  }, [needs, assignments, projects, m0]);

  /* ----- KPIs ----- */
  const activeProjects = projects.filter((p) => p.status === 'realised').length;
  const utilNow = series.realisedPct[m0idx] ?? 0;
  const utilPrev = m0idx > 0 ? series.realisedPct[m0idx - 1] : null;
  const gapNow = series.gapFte[m0idx] ?? 0;
  const gapPrev = m0idx > 0 ? series.gapFte[m0idx - 1] : null;

  const domainCounts = useMemo(() => {
    const counts = {};
    for (const r of resources) {
      const d = resourcePrimaryDomain(r);
      counts[d] = (counts[d] || 0) + 1;
    }
    return counts;
  }, [resources]);

  /* ----- chart ----- */
  const [hover, setHover] = useState(null);
  const tipIdx = hover ?? (m0idx >= 0 ? m0idx : 0);
  const W = 720, H = 150;
  const maxScale = Math.max(100, Math.ceil(Math.max(...series.plannedPct, 1) / 20) * 20);
  const x = (i) => (i / 11) * W;
  const y = (pct) => H - 8 - (pct / maxScale) * (H - 28);
  const realisedPts = series.realisedPct.map((v, i) => [x(i), y(v)]);
  const plannedPts = series.plannedPct.map((v, i) => [x(i), y(v)]);
  const realisedLine = smoothPath(realisedPts);

  /* ----- evaluations table ----- */
  const evalRows = useMemo(() => {
    if (!evals) return null;
    return [...evals]
      .sort((a, b) => {
        const w = (e) => (e.state === 'employee_submitted' || e.state === 'responsible_submitted' ? 0 : e.state === 'draft' ? 1 : 2);
        return w(a) - w(b) || new Date(b.periodEnd) - new Date(a.periodEnd);
      })
      .slice(0, 6);
  }, [evals]);

  const STATE_CHIP = {
    draft: ['Draft', 'bg-[#F0F4F8] text-text-light'],
    employee_submitted: ['Employee done', 'bg-warning-bg text-warning'],
    responsible_submitted: ['Responsible review', 'bg-warning-bg text-warning'],
    finalized: ['Finalized', 'bg-success-bg text-success'],
  };

  /* ----- right rail: people I personally manage (directly or via team) -----
     Managers are login users now; managedPersonIds is the server-computed set
     of people this user manages (direct links + teams they manage, self
     excluded). */
  const railPeople = useMemo(
    () => resources.filter((r) => managedPersonIds.has(r.id)).slice(0, 12),
    [resources, managedPersonIds]
  );

  /* ----- PM slice: customers I'm personally responsible for ----- */
  const myUserId = user?.id;
  const myCustomers = useMemo(() => {
    if (!myUserId) return [];
    return customers.filter(
      (c) =>
        c.responsibleUserId === myUserId ||
        projects.some((p) => p.customerId === c.id && p.responsibleUserId === myUserId)
    );
  }, [customers, projects, myUserId]);

  // Signals + last review per responsible customer (small N — one pair of calls each).
  const [pmInfo, setPmInfo] = useState({});
  useEffect(() => {
    const ids = myCustomers.slice(0, 8).map((c) => c.id);
    if (ids.length === 0) return;
    let dead = false;
    const from = addMonths(currentMonth(), -2);
    Promise.all(
      ids.map((id) =>
        Promise.all([
          api.getCustomerSignals(id, { from, to: currentMonth() }).catch(() => []),
          api.listCustomerReviews(id).catch(() => []),
        ]).then(([signals, reviews]) => [id, { signals, reviews }])
      )
    ).then((pairs) => {
      if (!dead) setPmInfo(Object.fromEntries(pairs));
    });
    return () => { dead = true; };
  }, [myCustomers]);

  const pmRows = useMemo(() => {
    return myCustomers.slice(0, 8).map((c) => {
      const projIds = new Set(projects.filter((p) => p.customerId === c.id).map((p) => p.id));
      const custNeeds = needs.filter((n) => projIds.has(n.projectId));
      const needIds = new Set(custNeeds.map((n) => n.id));
      let planned = 0, needed = 0;
      for (const a of assignments) {
        if (needIds.has(a.needId)) planned += (a.monthAllocations || {})[m0] || 0;
      }
      for (const n of custNeeds) needed += (n.monthAllocations || {})[m0] || 0;

      const info = pmInfo[c.id];
      let signal = null;
      if (info?.signals?.length) {
        // Latest month that has ratings within the 3-month window.
        const byMonth = new Map();
        for (const s of info.signals) {
          if (!byMonth.has(s.month)) byMonth.set(s.month, []);
          byMonth.get(s.month).push(s.rating);
        }
        const latest = [...byMonth.keys()].sort().pop();
        const ratings = byMonth.get(latest) || [];
        if (ratings.length) {
          signal = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
        }
      }
      let reviewDays = null;
      if (info?.reviews?.length) {
        const last = info.reviews
          .map((r) => new Date(r.reviewDate))
          .sort((a, b) => b - a)[0];
        reviewDays = Math.max(0, Math.round((Date.now() - last.getTime()) / 86400000));
      }
      const due = reminders.some(
        (i) => (i.type === 'pmUpdate' || i.type === 'clientSignal') && i.customerId === c.id
      );
      return {
        customer: c,
        projects: projIds.size,
        planned: Math.round(planned * 10) / 10,
        gap: Math.round(Math.max(0, needed - planned) * 10) / 10,
        signal,
        reviewDays,
        due,
      };
    });
  }, [myCustomers, projects, needs, assignments, m0, pmInfo, reminders]);

  // The top-reminder nudge moved into the left sidebar (Sidebar.jsx).
  const hasRail = railPeople.length > 0 || pmRows.length > 0;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date();
  const dateChip = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()]} · ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;

  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][today.getMonth()];

  /* donut geometry */
  const totalPeople = resources.length || 1;
  const CIRC = 2 * Math.PI * 16;
  let acc = 0;
  const donutSegs = Object.entries(domainCounts).map(([d, n]) => {
    const frac = n / totalPeople;
    const seg = { d, dash: `${Math.max(frac * CIRC - 2, 0)} ${CIRC}`, offset: -acc * CIRC, color: domainColor(d) };
    acc += frac;
    return seg;
  });

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6">
      {/* greeting */}
      <div className="flex items-start flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text m-0">
            {greet}, {firstName(user?.name) || 'there'} 👋
          </h1>
          <p className="text-xs text-text-mid mt-1 m-0">
            {insight.gap > 0.005 ? (
              <>
                {monthName} is <b className="text-danger">{Math.round(insight.gap * 10) / 10} FTE short</b> — {insight.openNeeds} need{insight.openNeeds === 1 ? '' : 's'} still open across {insight.customers} customer{insight.customers === 1 ? '' : 's'}.
              </>
            ) : (
              <>{monthName} is fully staffed — no open needs this month.</>
            )}
          </p>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] font-semibold text-text-mid bg-white border border-border-light rounded-full px-3 py-1.5">{dateChip}</span>
        <NotificationBell />
      </div>

      <div className={`grid grid-cols-1 ${hasRail ? 'xl:grid-cols-[1fr_280px]' : ''} gap-5 items-start`}>
        {/* main column */}
        <div className="min-w-0">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            <Kpi label="Active projects" chip="▦" chipBg="#E7F6FA" chipColor="#4CBAD4" spark={series.activeCount} sparkColor="#4CBAD4">
              {activeProjects} <span className="text-[11px] font-medium text-text-light">of {projects.length}</span>
            </Kpi>
            <Kpi label="Realised utilization" chip="◔" chipBg="#EAFAF0" chipColor="#34C98E" spark={series.realisedPct} sparkColor="#34C98E">
              {Math.round(utilNow)}<span className="text-[11px] font-medium text-text-light">%</span>
              <Delta value={utilPrev == null ? null : utilNow - utilPrev} suffix="%" />
            </Kpi>
            <Kpi label={`Unfilled (${MONTHS[today.getMonth()]})`} chip="◌" chipBg="#FDE8EA" chipColor="#E8636F" spark={series.gapFte} sparkColor="#E8636F">
              {Math.round(gapNow * 10) / 10} <span className="text-[11px] font-medium text-text-light">FTE</span>
              <Delta value={gapPrev == null ? null : gapNow - gapPrev} goodWhenDown />
            </Kpi>
            <Kpi
              label="By domain" chip="◑" chipBg="#F1ECFE" chipColor="#8B5CF6"
              donut={
                <>
                  <svg className="absolute right-3 top-4" width="44" height="44" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="16" fill="none" stroke="#EDF2F7" strokeWidth="8" />
                    {donutSegs.map((s) => (
                      <circle key={s.d} cx="22" cy="22" r="16" fill="none" stroke={s.color} strokeWidth="8" strokeDasharray={s.dash} strokeDashoffset={s.offset} transform="rotate(-90 22 22)" strokeLinecap="round" />
                    ))}
                  </svg>
                  <div className="absolute left-4 bottom-3 text-[9.5px] font-medium text-text-light font-mono">
                    {donutSegs.map((s, i) => `${s.d.slice(0, 4)} ${domainCounts[s.d]}`).join(' · ')}
                  </div>
                </>
              }
            >
              {resources.length} <span className="text-[11px] font-medium text-text-light">people</span>
            </Kpi>
          </div>

          {/* utilization chart */}
          <div className="relative bg-white border border-border-light rounded-2xl shadow-card p-4 mb-5">
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-[13px] font-bold text-text m-0">Utilization</h3>
              <span className="text-[10.5px] text-text-light">planned vs potential</span>
              <span className="flex-1" />
              <span className="text-[10.5px] font-semibold text-text-mid bg-primary-bg border border-border-light rounded-full px-2.5 py-1">Jan – Dec {year}</span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height: 170 }} preserveAspectRatio="none"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHover(Math.max(0, Math.min(11, Math.round(((e.clientX - r.left) / r.width) * 11))));
              }}
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id="homeUtilFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#4CBAD4" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#4CBAD4" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" y1={y(maxScale * f)} x2={W} y2={y(maxScale * f)} stroke="#EDF2F7" />
              ))}
              <path d={`${realisedLine} L${W} ${H} L0 ${H}Z`} fill="url(#homeUtilFill)" />
              <path d={smoothPath(plannedPts)} fill="none" stroke="#F5A623" strokeWidth="2" strokeDasharray="5 4" opacity="0.7" />
              <path d={realisedLine} fill="none" stroke="#4CBAD4" strokeWidth="2.5" />
              <line x1={x(tipIdx)} y1={y(series.realisedPct[tipIdx] || 0)} x2={x(tipIdx)} y2={H} stroke="#4CBAD4" strokeDasharray="3 3" opacity="0.4" />
              <circle cx={x(tipIdx)} cy={y(series.realisedPct[tipIdx] || 0)} r="4.5" fill="#4CBAD4" stroke="#fff" strokeWidth="2" />
            </svg>
            {/* dark tooltip */}
            <div
              className="absolute pointer-events-none bg-[#16323C] text-white rounded-xl px-3 py-2 shadow-lg"
              style={{ left: `clamp(8px, ${8 + (tipIdx / 11) * 84}%, calc(100% - 150px))`, top: 44, width: 140 }}
            >
              <b className="text-[10.5px]">{formatMonth(windowMonths[tipIdx])}</b>
              <div className="flex items-center gap-1.5 text-[10px] opacity-95 mt-1">
                <i className="w-2 h-2 rounded-full bg-[#4CBAD4]" />Planned
                <b className="ml-auto">{Math.round(series.realisedPct[tipIdx] || 0)}%</b>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] opacity-95 mt-0.5">
                <i className="w-2 h-2 rounded-full bg-[#F5A623]" />Potential
                <b className="ml-auto">{Math.round(series.plannedPct[tipIdx] || 0)}%</b>
              </div>
            </div>
            <div className="flex justify-between mt-1 px-0.5 text-[9.5px] font-mono text-text-light">
              {windowMonths.map((m, i) => (
                <span key={m} className={i === m0idx ? 'text-primary font-bold' : ''}>{MONTHS[i]}</span>
              ))}
            </div>
          </div>

          {/* evaluations in flight */}
          <div className="bg-white border border-border-light rounded-2xl shadow-card p-4">
            <div className="flex items-baseline gap-2 mb-1.5">
              <h3 className="text-[13px] font-bold text-text m-0">Evaluations in flight</h3>
              <span className="flex-1" />
              <Link to="/dashboard" className="text-[10.5px] font-semibold text-primary no-underline hover:underline">Insights →</Link>
            </div>
            {evalRows == null ? (
              <div className="py-6 text-center text-xs text-text-light">Loading…</div>
            ) : evalRows.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-light">No evaluations yet.</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Person', 'Customer', 'Period', 'State', ''].map((h, i) => (
                      <th key={i} className={`text-[9.5px] font-bold uppercase tracking-wider text-text-light py-1.5 border-b border-border-light ${i === 4 ? 'text-right' : 'text-left'}`}>{h || 'Score'}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evalRows.map((e) => {
                    const hot = e.state === 'employee_submitted' || e.state === 'responsible_submitted';
                    const [label, chipCls] = STATE_CHIP[e.state] || [e.state, 'bg-primary-bg text-text-mid'];
                    const score = e.overrideFinal ?? e.computedFinal;
                    return (
                      <tr
                        key={e.id}
                        onClick={() => navigate(`/people/${e.resourceId}/performance`)}
                        className={`cursor-pointer ${hot ? 'bg-[#FBFEFF] shadow-[inset_3px_0_0_#4CBAD4]' : 'hover:bg-primary-bg/40'}`}
                      >
                        <td className="py-2 border-b border-border-light/70">
                          <span className="flex items-center gap-2 text-xs font-semibold text-text">
                            <Avatar name={e.resource?.name} size={22} color={domainColor(resourcePrimaryDomain(resources.find((r) => r.id === e.resourceId) || {}))} />
                            {e.resource?.name}
                          </span>
                        </td>
                        <td className="py-2 border-b border-border-light/70 text-xs text-text-mid">{e.customerNameSnapshot || '—'}</td>
                        <td className="py-2 border-b border-border-light/70 text-[10.5px] font-mono text-text-mid">
                          {new Date(e.periodStart).toLocaleDateString('en-GB', { month: 'short' })} – {new Date(e.periodEnd).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                        </td>
                        <td className="py-2 border-b border-border-light/70">
                          <span className={`text-[9.5px] font-bold px-2 py-1 rounded-full ${chipCls}`}>{label}</span>
                        </td>
                        <td className="py-2 border-b border-border-light/70 text-right text-xs font-mono font-bold text-text">
                          {e.state === 'finalized' && score != null ? Math.round(score * 10) / 10 : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* right rail — your people + your customers, same row structure */}
        {hasRail && (
        <div className="flex flex-col gap-6 min-w-0">
          {railPeople.length > 0 && (
            <RailSection title="Your people" linkTo="/people" linkLabel="View all">
              {railPeople.map((r) => {
                const role = r.roles?.[0];
                const pct = Math.round(((rU[r.id]?.[m0] || 0) / (r.capacity || 1)) * 100);
                return (
                  <RailRow
                    key={r.id}
                    to={`/people/${r.id}`}
                    avatar={<Avatar name={r.name} size={30} color={domainColor(resourcePrimaryDomain(r))} />}
                    title={r.name}
                    meta={role ? `${role.domain} ${role.role} · ${SENIORITY_SHORT[role.seniority] || role.seniority}` : '—'}
                    chip={
                      <span className="text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded-md shrink-0" style={{ background: pct > 0 ? utilBg(pct) : '#F0F4F8', color: utilColor(pct) }}>
                        {pct}%
                      </span>
                    }
                  />
                );
              })}
            </RailSection>
          )}

          {pmRows.length > 0 && (
            <RailSection title="Your customers" linkTo="/customers" linkLabel="View all">
              {pmRows.map(({ customer: c, projects: pCount, planned, gap, signal, due }) => (
                <RailRow
                  key={c.id}
                  to={`/customers/${c.id}`}
                  hot={due}
                  avatar={
                    <span className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: '#6366f1' }}>
                      {c.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  }
                  title={c.name}
                  meta={`${pCount} project${pCount === 1 ? '' : 's'} · ${planned} FTE`}
                  chip={
                    gap > 0 ? (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-danger-bg text-danger">{gap} open</span>
                    ) : signal != null ? (
                      <span className="text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded-md shrink-0" style={{ background: scoreBg(signal), color: scoreColor(signal) }} title="Latest client satisfaction signal">
                        {signal}
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-success-bg text-success">staffed</span>
                    )
                  }
                />
              ))}
            </RailSection>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
