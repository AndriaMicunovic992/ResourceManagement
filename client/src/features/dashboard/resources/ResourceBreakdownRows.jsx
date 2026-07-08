import { useEffect, useMemo, useState } from 'react';
import BulletCell from '../BulletCell';
import { TipRow } from '../Tip';
import { api } from '../../../lib/api';
import { useData } from '../../../contexts/DataContext';
import { currentMonth, formatMonth } from '../../../lib/dateUtils';
import { MONTHLY_HOURS_PER_FTE, WORK_TYPE_COLORS, WORK_TYPE_LABELS } from '../../../lib/constants';
import { availabilityRatio, verdictWord } from '../../../lib/availability';

/**
 * The expanded person row: their hours per client (plan vs logged, in hours),
 * plus Internal work / Absences / Unmapped bucket rows — so a heatmap number
 * can be inspected down to where the time actually went. Per-customer hours
 * are lazy-loaded on expand; the buckets come from the already-loaded
 * per-type breakdown.
 */
export default function ResourceBreakdownRows({ resource, months, typedHours, window: win, accent }) {
  const { customers, needs, projects, assignments } = useData();
  const cur = currentMonth();
  // { byCustomer: { [customerId]: { [month]: hours } },
  //   unmapped: [{ key, name, months }] } — per-Jira-project rows for client
  // hours that resolve to no customer.
  const [actualsData, setActualsData] = useState(null);

  useEffect(() => {
    if (!win?.from || !win?.to) { setActualsData({ byCustomer: {}, unmapped: [] }); return; }
    let dead = false;
    Promise.all([
      api.getResourceActualsByCustomer(resource.id, win.from, win.to).catch(() => ({})),
      api.getResourceUnmappedActuals(resource.id, win.from, win.to).catch(() => []),
    ]).then(([byCustomer, unmapped]) => {
      if (!dead) setActualsData({ byCustomer: byCustomer || {}, unmapped: unmapped || [] });
    });
    return () => { dead = true; };
  }, [resource.id, win?.from, win?.to]);
  const byCustomer = actualsData?.byCustomer ?? null;

  // This person's realised planned hours per customer per month, from their
  // assignments (need → project → customer, realised chains only — matching
  // the plan track of the parent row).
  const plannedByCustomer = useMemo(() => {
    const needById = new Map(needs.map((n) => [n.id, n]));
    const projById = new Map(projects.map((p) => [p.id, p]));
    const custById = new Map(customers.map((c) => [c.id, c]));
    const out = {};
    for (const a of assignments) {
      if (a.resourceId !== resource.id) continue;
      const need = needById.get(a.needId);
      if (!need || need.status !== 'realised') continue;
      const project = projById.get(need.projectId);
      if (!project || project.status !== 'realised') continue;
      const customer = custById.get(project.customerId);
      if (!customer || customer.status !== 'realised') continue;
      const byMonth = (out[customer.id] = out[customer.id] || {});
      for (const [m, fte] of Object.entries(a.monthAllocations || {})) {
        byMonth[m] = (byMonth[m] || 0) + fte * MONTHLY_HOURS_PER_FTE;
      }
    }
    return out;
  }, [assignments, needs, projects, customers, resource.id]);

  const rows = useMemo(() => {
    if (byCustomer == null) return null; // still loading
    const monthSet = new Set(months);
    const custName = new Map(customers.map((c) => [c.id, c.name]));
    const inWindow = (byMonth) => Object.entries(byMonth || {}).some(([m, v]) => monthSet.has(m) && v > 0.05);

    // One row per customer with plan or logged hours in the window.
    const ids = new Set([
      ...Object.keys(byCustomer).filter((id) => inWindow(byCustomer[id])),
      ...Object.keys(plannedByCustomer).filter((id) => inWindow(plannedByCustomer[id])),
    ]);
    const sumAct = (byMonth) => months.reduce((s, m) => s + (byMonth?.[m] || 0), 0);
    const custRows = [...ids]
      .map((id) => ({
        key: id,
        name: custName.get(id) || 'Unknown customer',
        color: WORK_TYPE_COLORS.client,
        plan: (m) => plannedByCustomer[id]?.[m] || 0,
        act: (m) => (m <= cur ? byCustomer[id]?.[m] || 0 : null),
      }))
      .sort((a, b) => sumAct(byCustomer[b.key]) - sumAct(byCustomer[a.key]) || a.name.localeCompare(b.name));

    // Bucket rows: internal work and absences (from the per-type data).
    const typeSum = (m, k) => typedHours?.[m]?.[k] || 0;
    const buckets = [
      { key: 'internal', name: WORK_TYPE_LABELS.internal, color: WORK_TYPE_COLORS.internal, hours: (m) => typeSum(m, 'internal') },
      { key: 'absence', name: WORK_TYPE_LABELS.absence, color: WORK_TYPE_COLORS.absence, hours: (m) => typeSum(m, 'absence') },
    ]
      .filter((b) => months.some((m) => m <= cur && b.hours(m) > 0.05))
      .map((b) => ({ key: b.key, name: b.name, color: b.color, plan: () => 0, act: (m) => (m <= cur ? b.hours(m) : null) }));

    // Client hours that resolve to no customer, one row per Jira project —
    // flagged so it's obvious this time was neither planned nor mapped, but
    // still inspectable by name instead of one opaque bucket.
    const unmappedRows = (actualsData?.unmapped || [])
      .filter((u) => Object.entries(u.months || {}).some(([m, v]) => monthSet.has(m) && v > 0.05))
      .map((u) => ({
        key: `jira:${u.key}`,
        name: u.name === u.key ? u.key : `${u.name} (${u.key})`,
        // "stale mapping" = the Jira project IS mapped/classified, but these
        // hours were attributed before that — Re-apply mappings moves them.
        badge: u.stale ? 'stale mapping' : 'not mapped',
        color: '#F5A623',
        note: u.stale
          ? `Jira ${u.key} is mapped, but these hours were synced before that — run “Re-apply mappings” under Settings → Integrations to move them.`
          : `Jira ${u.key} isn’t mapped to a customer — map or classify it under Settings → Integrations.`,
        plan: () => 0,
        act: (m) => (m <= cur ? u.months?.[m] || 0 : null),
      }));

    return [...custRows, ...buckets, ...unmappedRows];
  }, [byCustomer, actualsData, plannedByCustomer, customers, months, typedHours, cur]);

  // Shared hour scale across the breakdown, floored so small values stay small.
  const scaleMax = useMemo(() => {
    if (!rows) return 40;
    let max = 40;
    for (const r of rows) for (const m of months) max = Math.max(max, r.plan(m), r.act(m) || 0);
    return max;
  }, [rows, months]);

  if (rows == null) {
    return (
      <div className="flex items-center border-b border-border-light/60 bg-[#FAFBFD] pl-12 py-2 text-[10px] text-text-light">
        Loading hours…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="flex items-center border-b border-border-light/60 bg-[#FAFBFD] pl-12 py-2 text-[10px] text-text-light">
        No hours in this window.
      </div>
    );
  }

  const fmtH = (v) => `${Math.round(v)}`;

  return rows.map((row) => {
    const totalAct = months.reduce((s, m) => s + (row.act(m) || 0), 0);
    return (
      <div key={row.key} className="flex items-center border-b border-border-light/60 bg-[#FAFBFD]">
        <div className="w-[270px] shrink-0 pl-12 pr-3 py-1 flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: row.color }} />
          <span className="text-[11px] font-semibold text-text-mid truncate" title={row.name}>{row.name}</span>
          {row.badge && (
            <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-warning-bg text-warning shrink-0">
              {row.badge}
            </span>
          )}
          <span className="text-[9px] font-mono text-text-light ml-auto shrink-0">Σ {Math.round(totalAct)}h</span>
        </div>
        {months.map((m) => {
          const plan = row.plan(m);
          const act = row.act(m);
          const partial = m === cur;
          // The plan reduced by the person's synced absences that month —
          // vacation shrinks every client's expectation proportionally.
          const ratio = m <= cur ? availabilityRatio(typedHours?.[m], resource.capacity) : 1;
          const expected = plan * ratio;
          // Δ in hours against the expectation — ratios read as noise when the
          // plan is small.
          let delta = null;
          if (act != null && !partial && plan > 0 && act > 0) {
            const base = expected > 1 ? expected : plan;
            const word = verdictWord(act, base);
            const d = act - base;
            delta = `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d))}h${word ? ` · ${word}` : ''}`;
          }
          const tip = plan > 0 || (act || 0) > 0 ? (
            <>
              <b className="text-[11px]">{resource.name} · {row.name} · {formatMonth(m)}</b>
              {plan > 0 && <TipRow swatch={accent} label="Planned" value={`${Math.round(plan)}h`} />}
              {act != null && plan > 0 && plan - expected > 1 && (
                <TipRow label="Expected" value={`${Math.round(expected)}h · after absences`} />
              )}
              {act != null && (act > 0 || plan > 0) && (
                <TipRow swatch={row.color} label="Logged" value={`${Math.round(act * 10) / 10}h${partial ? ' so far' : ''}`} />
              )}
              {delta && <TipRow label="Δ" value={delta} />}
              {partial && <div className="opacity-80">month in progress</div>}
              {row.note && <div className="opacity-80 mt-0.5 max-w-[210px]">{row.note}</div>}
            </>
          ) : null;
          return (
            <BulletCell key={m}
              plan={plan}
              act={act}
              actSegments={act != null && act > 0 ? [{ value: act, color: row.color }] : null}
              max={scaleMax}
              accent={accent}
              inProgress={act != null && partial}
              labelAct={act != null && (act > 0 || plan > 0) ? (plan > 0 ? fmtH(act) : `${fmtH(act)}h`) : null}
              labelPlan={plan > 0 ? `${fmtH(plan)}h` : null}
              tip={tip}
            />
          );
        })}
      </div>
    );
  });
}
