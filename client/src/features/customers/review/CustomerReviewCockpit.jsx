import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useData } from '../../../contexts/DataContext';
import { useVisibility } from '../../../contexts/VisibilityContext';
import Avatar from '../../../components/ui/Avatar';
import MiniThread, { ReplyToggle } from '../../../components/ui/MiniThread';
import SignalChart from '../../../components/ui/SignalChart';
import CategoryMultiPicker from '../../../components/forms/CategoryMultiPicker';
import PlannedVsActualChart from '../../../components/ui/PlannedVsActualChart';
import { fteToHours, MONTHLY_HOURS_PER_FTE, LOG_KIND_COLORS, LOG_KIND_LABELS } from '../../../lib/constants';
import { currentMonth, addMonths, monthRange } from '../../../lib/dateUtils';

// The PM's structured recap fields. Each is an entry type, pre-linked to this
// customer, this review session, and the picked dimensions.
const REVIEW_ROWS = [
  { kind: 'strength', label: 'Strengths in action', hint: 'What did this person do well, with context?' },
  { kind: 'concern', label: 'Areas of concern', hint: 'What fell short of expectations?' },
  { kind: 'incident', label: 'Incidents', hint: 'Hard facts only: missed deadline, quality failure, conflict.' },
  { kind: 'blocker', label: "Blockers they're facing", hint: 'Outside their control, slowing them down.' },
];

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function monthLabel(key) {
  const d = new Date(`${key}-01T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short' });
}

/** Composer for one structured field on one person, attached to this review. */
function EntryComposer({ row, person, customer, reviewId, projects, logCategories, onCreated, onCancel }) {
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');
  const [categoryIds, setCategoryIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError('');
    try {
      // person === null → a general (whole-customer) entry.
      const created = person
        ? await api.createLog(person.id, {
            content: content.trim(),
            kind: row.kind,
            customerId: customer.id,
            projectId: projectId || null,
            categoryIds,
            customerReviewId: reviewId,
          })
        : await api.createCustomerGeneralLog(customer.id, {
            content: content.trim(),
            kind: row.kind,
            projectId: projectId || null,
            categoryIds,
            customerReviewId: reviewId,
          });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Failed to save entry');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-primary rounded-lg p-2.5 bg-primary-bg space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder={row.hint}
        autoFocus
        className="w-full px-2 py-1.5 border border-border-light rounded-lg text-xs text-text outline-none focus:border-primary bg-white resize-y"
        required
      />
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="px-2 py-1 border border-border-light rounded-lg text-[11px] text-text outline-none bg-white max-w-[220px]"
      >
        <option value="">Project: whole customer</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <CategoryMultiPicker logCategories={logCategories} value={categoryIds} onChange={setCategoryIds} />
      {error && <div className="text-[10px] text-danger">{error}</div>}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] font-semibold text-text-mid bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !content.trim()}
          className="text-[11px] font-bold text-white bg-primary border-0 rounded-lg px-3 py-1 cursor-pointer hover:brightness-105 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Add entry'}
        </button>
      </div>
    </form>
  );
}

/** Compact "+" that sits next to a dimension label to open its composer. */
function AddDot({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Add to ${label}`}
      title={`Add to ${label}`}
      className="w-[18px] h-[18px] rounded-full bg-primary-light text-primary text-[13px] leading-none font-bold flex items-center justify-center cursor-pointer hover:bg-primary hover:text-white transition shrink-0"
    >
      +
    </button>
  );
}

/**
 * General (whole-customer) section: entries unrelated to a specific person.
 * They roll into the evaluation of everyone working on the customer/project.
 */
function GeneralReviewCard({ customer, reviewId, custProjects, logCategories, entries, onEntryCreated, onEntryDeleted }) {
  const [composing, setComposing] = useState(null);
  const byKind = (kind) => entries.filter((l) => l.kind === kind);

  const handleDelete = async (logId) => {
    if (!window.confirm('Delete this general entry?')) return;
    try {
      await api.deleteCustomerGeneralLog(customer.id, logId);
      onEntryDeleted(logId);
    } catch {
      /* surfaced rarely; ignore to keep the cockpit responsive */
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card p-4">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-[34px] h-[34px] rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: '#6366f1' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>
        </span>
        <div>
          <div className="text-sm font-bold text-text">General · whole customer</div>
          <div className="text-[10px] text-text-light">
            Applies to everyone working on {customer.name} this period — rolls into each person's evaluation.
          </div>
        </div>
      </div>

      <div className="space-y-2.5 mt-3">
        {REVIEW_ROWS.map((row) => (
          <div key={row.kind}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="text-[10px] uppercase tracking-wider text-text-mid font-bold">{row.label}</div>
              {composing !== row.kind && (
                <AddDot onClick={() => setComposing(row.kind)} label={row.label} />
              )}
            </div>
            {composing === row.kind && (
              <EntryComposer
                row={row}
                person={null}
                customer={customer}
                reviewId={reviewId}
                projects={custProjects}
                logCategories={logCategories}
                onCreated={(created) => {
                  onEntryCreated(created);
                  setComposing(null);
                }}
                onCancel={() => setComposing(null)}
              />
            )}
            <div className="space-y-1.5 mt-1">
              {byKind(row.kind).map((log) => (
                <div key={log.id} className="rounded-lg border border-border-light p-2 group">
                  <div className="flex items-start gap-2">
                    <div className="text-xs text-text whitespace-pre-wrap flex-1">{log.content}</div>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="text-[10px] text-text-light opacity-0 group-hover:opacity-100 hover:text-danger shrink-0"
                      title="Delete entry"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {(log.categories || []).map((c) => (
                      <span key={c.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary-light text-primary">{c.name}</span>
                    ))}
                    {log.project && <span className="text-[9px] text-text-light">📁 {log.project.name}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One person's section in this review: optional client score + the 4 fields. */
function PersonReviewCard({
  person,
  customer,
  reviewId,
  fte,
  actualHours,
  custProjects,
  logCategories,
  monthSignal,
  onSignal,
  onSignalCleared,
  entries,
  onEntryCreated,
  onEntryUpdated,
}) {
  const [composing, setComposing] = useState(null);
  const [signalBusy, setSignalBusy] = useState(false);
  const [error, setError] = useState('');
  const month = currentMonth();

  const handleRate = async (rating) => {
    setSignalBusy(true);
    setError('');
    try {
      if (monthSignal?.rating === rating && monthSignal?.id) {
        // Clicking the selected rating again clears this month's signal.
        await api.deleteCustomerSignal(customer.id, monthSignal.id);
        onSignalCleared(person.id, month);
      } else {
        const saved = await api.upsertCustomerSignal(customer.id, {
          resourceId: person.id,
          month,
          rating,
        });
        onSignal(saved);
      }
    } catch (err) {
      setError(err.message || 'Failed to save rating');
    }
    setSignalBusy(false);
  };

  const byKind = (kind) => entries.filter((l) => l.kind === kind);

  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={person.name} color="#4CBAD4" size={34} />
          <div>
            <Link
              to={`/people/${person.id}`}
              className="text-sm font-bold text-text no-underline hover:text-primary"
            >
              {person.name}
            </Link>
            <div className="text-[10px] text-text-light">
              Planned this month: {fte > 0 ? `${fte.toFixed(1)} FTE (≈${fteToHours(fte)}h)` : '—'}
              {' · '}actual: {actualHours != null ? <span className="font-semibold text-text-mid">{actualHours}h</span> : '—'}
            </div>
          </div>
        </div>
        {/* Optional: this month's client satisfaction (one per month). */}
        <div className="text-right">
          <div className="text-[10px] font-semibold text-text-mid uppercase tracking-wider mb-1">
            Client satisfaction · {monthLabel(month)} (optional)
          </div>
          <div className="flex gap-1 justify-end">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={signalBusy}
                onClick={() => handleRate(n)}
                title={monthSignal?.rating === n ? 'Click again to clear' : `Set ${n}/5`}
                className={`w-7 h-7 rounded-lg border text-xs font-bold cursor-pointer ${
                  monthSignal?.rating === n
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-mid border-border hover:border-primary'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-2">{error}</div>}

      <div className="space-y-2.5">
        {REVIEW_ROWS.map((row) => (
          <div key={row.kind}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="text-[10px] uppercase tracking-wider text-text-mid font-bold">
                {row.label}
              </div>
              {composing !== row.kind && (
                <AddDot onClick={() => setComposing(row.kind)} label={row.label} />
              )}
            </div>
            {composing === row.kind && (
              <EntryComposer
                row={row}
                person={person}
                customer={customer}
                reviewId={reviewId}
                projects={custProjects}
                logCategories={logCategories}
                onCreated={(created) => {
                  onEntryCreated(created);
                  setComposing(null);
                }}
                onCancel={() => setComposing(null)}
              />
            )}
            <div className="space-y-1.5 mt-1">
              {byKind(row.kind).map((log) => (
                <div key={log.id} className="rounded-lg border border-border-light p-2">
                  <div className="text-xs text-text whitespace-pre-wrap">{log.content}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {(log.categories || []).map((c) => (
                      <span key={c.id} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary-light text-primary">
                        {c.name}
                      </span>
                    ))}
                    {log.project && (
                      <span className="text-[9px] text-text-light">📁 {log.project.name}</span>
                    )}
                  </div>
                  <MiniThread personId={person.id} log={log} onUpdated={onEntryUpdated} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One PM review session (a dated record, like a 1:1). Left: per-person recap
 * work. Right: customer satisfaction chart + recent history with threads.
 */
export default function CustomerReviewCockpit() {
  const { customerId, reviewId } = useParams();
  const navigate = useNavigate();
  const { customers, projects, needs, assignments, resources, logCategories } = useData();
  const { isAdmin, responsibleCustomerIds, loading: visLoading } = useVisibility();

  const customer = customers.find((c) => c.id === customerId);
  const canReview = isAdmin || responsibleCustomerIds.has(customerId);

  const [review, setReview] = useState(null);
  const [signals, setSignals] = useState([]);
  const [reviewEntries, setReviewEntries] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [collapsedPeople, setCollapsedPeople] = useState(() => new Set());
  const [openReplies, setOpenReplies] = useState(() => new Set());
  const toggleReply = (id) =>
    setOpenReplies((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visLoading && !canReview) navigate(`/customers/${customerId}`, { replace: true });
  }, [visLoading, canReview, navigate, customerId]);

  const months = useMemo(() => monthRange(addMonths(currentMonth(), -11), currentMonth()), []);
  const entriesFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (visLoading || !canReview) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getCustomerReview(customerId, reviewId),
      api.getCustomerSignals(customerId, { from: months[0], to: months[months.length - 1] }),
      api.getCustomerActivity(customerId, { customerReviewId: reviewId, limit: 500 }),
      api.getCustomerActivity(customerId, { from: entriesFrom, limit: 500 }),
    ])
      .then(([rec, sigs, attached, recent]) => {
        if (cancelled) return;
        setReview(rec);
        setSignals(Array.isArray(sigs) ? sigs : []);
        setReviewEntries(Array.isArray(attached) ? attached : []);
        setRecentEntries(
          (Array.isArray(recent) ? recent : []).filter((l) => l.customerReviewId !== reviewId)
        );
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load review');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visLoading, canReview, customerId, reviewId, months, entriesFrom]);

  const custProjects = useMemo(
    () => projects.filter((p) => p.customerId === customerId),
    [projects, customerId]
  );

  const people = useMemo(() => {
    const nowKey = currentMonth();
    const needIds = new Set(
      needs.filter((n) => custProjects.some((p) => p.id === n.projectId)).map((n) => n.id)
    );
    const byPerson = new Map();
    for (const a of assignments) {
      if (!needIds.has(a.needId)) continue;
      const fte = (a.monthAllocations || {})[nowKey] || 0;
      if (fte <= 0) continue;
      byPerson.set(a.resourceId, (byPerson.get(a.resourceId) || 0) + fte);
    }
    return Array.from(byPerson.entries())
      .map(([id, fte]) => ({ person: resources.find((r) => r.id === id), fte }))
      .filter((x) => x.person)
      .sort((a, b) => b.fte - a.fte);
  }, [assignments, needs, custProjects, resources]);

  // Planned (allocations on this customer's needs) vs actual (Tempo) hours/month.
  const [custActuals, setCustActuals] = useState({});
  useEffect(() => {
    if (!customerId) return;
    api.getMonthlyActualsByCustomer(months[0], months[months.length - 1]).then(setCustActuals).catch(() => setCustActuals({}));
  }, [customerId, months]);
  const plannedActualData = useMemo(() => {
    const needIds = new Set(needs.filter((n) => custProjects.some((p) => p.id === n.projectId)).map((n) => n.id));
    return months.map((m) => {
      let fte = 0;
      for (const a of assignments) {
        if (!needIds.has(a.needId)) continue;
        fte += (a.monthAllocations || {})[m] || 0;
      }
      return { month: m, planned: fte * MONTHLY_HOURS_PER_FTE, actual: custActuals[customerId]?.[m] || 0 };
    });
  }, [months, needs, custProjects, assignments, custActuals, customerId]);

  // Customer satisfaction chart: monthly average across all rated people.
  const chartPoints = useMemo(() => {
    return months.map((m) => {
      const ratings = signals.filter((s) => s.month === m).map((s) => s.rating);
      return {
        label: monthLabel(m),
        value: ratings.length
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null,
      };
    });
  }, [signals, months]);

  const month = currentMonth();

  // Actual hours (from synced Tempo worklogs) for this customer this month,
  // per person — shown next to the planned figure.
  const [actualHours, setActualHours] = useState({});
  useEffect(() => {
    if (!customer?.id) return;
    api.getActualHours(customer.id, month).then(setActualHours).catch(() => setActualHours({}));
  }, [customer?.id, month]);

  if (visLoading || loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10 text-center text-xs text-text-light">
        Loading review…
      </div>
    );
  }
  if (error || !review || !customer) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        <div className="text-xs text-danger bg-danger-bg p-3 rounded">
          {error || 'Review not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-5">
      {/* Header — entity profile-card language */}
      <div
        className="flex items-center gap-4 border border-border-light rounded-[18px] p-[18px] mb-4 flex-wrap"
        style={{ background: 'linear-gradient(120deg, #F4FBFD, #fff)' }}
      >
        <div
          className="w-[48px] h-[48px] rounded-2xl flex items-center justify-center text-base font-bold text-white shrink-0 shadow-lg"
          style={{ background: '#6366f1' }}
        >
          {customer.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-text m-0 truncate">
            PM review — {customer.name}
          </h2>
          <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
            <span className="text-[9.5px] font-mono font-semibold text-primary bg-primary-light rounded-[7px] px-2 py-0.5">
              {formatDate(review.reviewDate)}
            </span>
            <span className="text-[9.5px] font-mono font-semibold text-text-mid bg-[#EEF1F5] rounded-[7px] px-2 py-0.5">
              by {review.authorUser?.name || '—'}
            </span>
            <span className="text-[10px] text-text-light">
              entries link to this session, the customer and your chosen dimensions
            </span>
          </div>
        </div>
        <Link
          to={`/customers/${customerId}/people`}
          className="ml-auto rounded-[11px] font-bold text-[11.5px] px-3.5 py-2.5 no-underline bg-white text-text-mid border border-border-light hover:bg-primary-bg"
        >
          ← Back to customer
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Main column: general recap + per-person recap */}
        <div className="lg:col-span-2 space-y-4">
          <GeneralReviewCard
            customer={customer}
            reviewId={reviewId}
            custProjects={custProjects}
            logCategories={logCategories}
            entries={reviewEntries.filter((l) => !l.resourceId)}
            onEntryCreated={(created) => setReviewEntries((prev) => [created, ...prev])}
            onEntryDeleted={(logId) => setReviewEntries((prev) => prev.filter((l) => l.id !== logId))}
          />
          {people.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border-light shadow-card p-8 text-center text-sm text-text-light">
              No people allocated to this customer this month.
            </div>
          ) : (
            people.map(({ person, fte }) => (
              <PersonReviewCard
                key={person.id}
                person={person}
                customer={customer}
                reviewId={reviewId}
                fte={fte}
                actualHours={actualHours[person.id]}
                custProjects={custProjects}
                logCategories={logCategories}
                monthSignal={signals.find((s) => s.resourceId === person.id && s.month === month)}
                onSignal={(saved) =>
                  setSignals((prev) => {
                    const rest = prev.filter(
                      (s) => !(s.resourceId === saved.resourceId && s.month === saved.month)
                    );
                    return [...rest, saved];
                  })
                }
                onSignalCleared={(resourceId, m) =>
                  setSignals((prev) =>
                    prev.filter((s) => !(s.resourceId === resourceId && s.month === m))
                  )
                }
                entries={reviewEntries.filter((l) => l.resourceId === person.id)}
                onEntryCreated={(created) => setReviewEntries((prev) => [created, ...prev])}
                onEntryUpdated={(updated) =>
                  setReviewEntries((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
                }
              />
            ))
          )}
        </div>

        {/* Context column — one unified, sticky card. A single box (vs. two
            stacked ones) has no internal gap to misalign with the left. */}
        <div className="lg:sticky lg:top-4 self-start bg-white rounded-2xl border border-border-light shadow-card p-4">
          <h3 className="text-[13px] font-bold text-text m-0 mb-2">
            Customer satisfaction (12 mo avg)
          </h3>
          <SignalChart points={chartPoints} height={200} />

          <div className="mt-4 pt-4 border-t border-border-light">
            <h3 className="text-[13px] font-bold text-text m-0 mb-2">Planned vs actual hours</h3>
            <PlannedVsActualChart data={plannedActualData} />
          </div>

          <div className="mt-4 pt-4 border-t border-border-light">
            <h3 className="text-[13px] font-bold text-text m-0 mb-2">
              Recent entries (60 days)
            </h3>
            <div className="space-y-2 overflow-y-auto pr-1 -mr-1" style={{ maxHeight: 'calc(100vh - 380px)' }}>
              {recentEntries.length === 0 && (
                <div className="text-xs text-text-light">Nothing logged in this window.</div>
              )}
              {people.map(({ person }) => {
                const personLogs = recentEntries.filter((l) => l.resourceId === person.id);
                if (personLogs.length === 0) return null;
                const collapsed = collapsedPeople.has(person.id);
                return (
                  <div key={person.id}>
                    <button
                      onClick={() =>
                        setCollapsedPeople((prev) => {
                          const next = new Set(prev);
                          if (next.has(person.id)) next.delete(person.id);
                          else next.add(person.id);
                          return next;
                        })
                      }
                      className="w-full flex items-center justify-between text-[11px] font-bold text-text bg-transparent border-0 cursor-pointer px-0 py-1"
                    >
                      <span>{collapsed ? '▸' : '▾'} {person.name}</span>
                      <span className="text-text-light font-normal">{personLogs.length}</span>
                    </button>
                    {!collapsed &&
                      personLogs.map((log) => (
                        <div key={log.id} className="rounded-lg border border-border-light p-2 mb-1.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                                LOG_KIND_COLORS[log.kind] || LOG_KIND_COLORS.note
                              }`}
                            >
                              {LOG_KIND_LABELS[log.kind] || log.kind}
                            </span>
                            <span className="text-[10px] text-text-light">
                              {formatDate(log.createdAt)}
                            </span>
                            <ReplyToggle open={openReplies.has(log.id)} onClick={() => toggleReply(log.id)} />
                          </div>
                          <div className="text-xs text-text whitespace-pre-wrap">{log.content}</div>
                          <MiniThread
                            personId={log.resourceId}
                            log={log}
                            open={openReplies.has(log.id)}
                            onToggle={() => toggleReply(log.id)}
                            onUpdated={(updated) =>
                              setRecentEntries((prev) =>
                                prev.map((l) => (l.id === updated.id ? updated : l))
                              )
                            }
                          />
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
