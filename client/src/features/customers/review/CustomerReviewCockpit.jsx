import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useData } from '../../../contexts/DataContext';
import { useVisibility } from '../../../contexts/VisibilityContext';
import Avatar from '../../../components/ui/Avatar';
import MiniThread from '../../../components/ui/MiniThread';
import CategoryMultiPicker from '../../../components/forms/CategoryMultiPicker';
import { fteToHours } from '../../../lib/constants';
import { currentMonth, addMonths, monthRange } from '../../../lib/dateUtils';

// The PM's structured recap fields. Each is an entry type, pre-linked to this
// customer and to the picked dimensions, so review evidence is ready-made.
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

function ratingClass(r) {
  if (r >= 4) return 'bg-success-bg text-success';
  if (r === 3) return 'bg-warning-bg text-warning';
  return 'bg-danger-bg text-danger';
}

/** Composer for one structured field on one person. */
function EntryComposer({ row, person, customer, projects, logCategories, onCreated, onCancel }) {
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
      const created = await api.createLog(person.id, {
        content: content.trim(),
        kind: row.kind,
        customerId: customer.id,
        projectId: projectId || null,
        categoryIds,
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
        className="w-full px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white resize-y"
        required
      />
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-2 py-1 border border-border rounded text-[11px] text-text outline-none bg-white max-w-[200px]"
        >
          <option value="">Project: whole customer</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
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
          className="text-[11px] font-semibold text-white bg-primary border-0 rounded px-3 py-1 cursor-pointer hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Add entry'}
        </button>
      </div>
    </form>
  );
}

/** One person's review card: signal, structured fields, recent entries. */
function PersonReviewCard({
  person,
  customer,
  fte,
  custProjects,
  logCategories,
  signals,
  onSignal,
  entries,
  onEntryCreated,
  onEntryUpdated,
}) {
  const [composing, setComposing] = useState(null); // kind | null
  const [signalBusy, setSignalBusy] = useState(false);
  const [error, setError] = useState('');
  const month = currentMonth();
  const thisMonthSignal = signals.find((s) => s.month === month);

  const handleRate = async (rating) => {
    setSignalBusy(true);
    setError('');
    try {
      const saved = await api.upsertCustomerSignal(customer.id, {
        resourceId: person.id,
        month,
        rating,
      });
      onSignal(saved);
    } catch (err) {
      setError(err.message || 'Failed to save rating');
    }
    setSignalBusy(false);
  };

  const byKind = (kind) => entries.filter((l) => l.kind === kind);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-4">
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
              {' · '}actual hours: coming with Tempo
            </div>
          </div>
        </div>
        {/* Monthly client satisfaction — one entry per month, hidden from the person. */}
        <div className="text-right">
          <div className="text-[10px] font-semibold text-text-mid uppercase tracking-wider mb-1">
            Client satisfaction · {monthLabel(month)}
          </div>
          <div className="flex gap-1 justify-end">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={signalBusy}
                onClick={() => handleRate(n)}
                className={`w-7 h-7 rounded-lg border text-xs font-bold cursor-pointer ${
                  thisMonthSignal?.rating === n
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-mid border-border hover:border-primary'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {signals.length > 0 && (
            <div className="flex gap-1 justify-end mt-1">
              {signals.slice(-6).map((s) => (
                <span
                  key={s.id}
                  title={s.note || ''}
                  className={`text-[9px] font-bold px-1 py-0.5 rounded ${ratingClass(s.rating)}`}
                >
                  {monthLabel(s.month)} {s.rating}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-2">{error}</div>}

      <div className="space-y-2.5">
        {REVIEW_ROWS.map((row) => (
          <div key={row.kind}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wider text-text-mid font-bold">
                {row.label}
              </div>
              {composing !== row.kind && (
                <button
                  onClick={() => setComposing(row.kind)}
                  className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline"
                >
                  + Add entry
                </button>
              )}
            </div>
            {composing === row.kind && (
              <EntryComposer
                row={row}
                person={person}
                customer={customer}
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
              {byKind(row.kind).length === 0 && composing !== row.kind && (
                <div className="text-[11px] text-text-light italic">No entries this window.</div>
              )}
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
                    <span className="text-[10px] text-text-light ml-auto">
                      {log.authorUser?.name || '—'} · {formatDate(log.createdAt)}
                    </span>
                  </div>
                  <MiniThread
                    personId={person.id}
                    log={log}
                    onUpdated={onEntryUpdated}
                  />
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
 * PM review mode for one customer: a cockpit to recap each allocated person —
 * structured entries (pre-linked to customer + dimensions) and the monthly
 * client satisfaction rating. Everything logged here also feeds the person's
 * 1:1 cockpit and the evaluation evidence.
 */
export default function CustomerReviewCockpit() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { customers, projects, needs, assignments, resources, logCategories } = useData();
  const { isAdmin, responsibleCustomerIds, loading: visLoading } = useVisibility();

  const customer = customers.find((c) => c.id === customerId);
  const canReview = isAdmin || responsibleCustomerIds.has(customerId);

  const [signals, setSignals] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visLoading && !canReview) navigate(`/customers/${customerId}`, { replace: true });
  }, [visLoading, canReview, navigate, customerId]);

  const months = useMemo(() => monthRange(addMonths(currentMonth(), -5), currentMonth()), []);
  // Entries window: last 60 days of activity on this customer.
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
      api.getCustomerSignals(customerId, { from: months[0], to: months[months.length - 1] }),
      api.getCustomerActivity(customerId, { from: entriesFrom, limit: 500 }),
    ])
      .then(([sigs, logs]) => {
        if (cancelled) return;
        setSignals(Array.isArray(sigs) ? sigs : []);
        setEntries(Array.isArray(logs) ? logs : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load review data');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visLoading, canReview, customerId, months, entriesFrom]);

  const custProjects = useMemo(
    () => projects.filter((p) => p.customerId === customerId),
    [projects, customerId]
  );

  // People allocated to this customer this month (plus FTE), sorted by FTE.
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

  if (visLoading || loading) {
    return (
      <div className="max-w-[900px] mx-auto px-5 py-10 text-center text-xs text-text-light">
        Loading review…
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="max-w-[900px] mx-auto px-5 py-10">
        <div className="text-xs text-danger bg-danger-bg p-3 rounded">Customer not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-5 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-text m-0">PM review — {customer.name}</h2>
          <div className="text-[11px] text-text-mid">
            Recap each person's month on this customer. Entries are linked to the customer and
            your chosen dimensions, and show up in 1:1 cockpits and evaluations.
          </div>
        </div>
        <Link
          to={`/customers/${customerId}/people`}
          className="text-xs font-semibold text-text-mid border border-border rounded-lg px-3 py-1.5 no-underline hover:bg-white"
        >
          ← Back to customer
        </Link>
      </div>

      {error && <div className="text-xs text-danger bg-danger-bg p-2 rounded mb-3">{error}</div>}

      {people.length === 0 ? (
        <div className="bg-white rounded-xl border border-border shadow-card p-8 text-center text-sm text-text-light">
          No people allocated to this customer this month.
        </div>
      ) : (
        <div className="space-y-4">
          {people.map(({ person, fte }) => (
            <PersonReviewCard
              key={person.id}
              person={person}
              customer={customer}
              fte={fte}
              custProjects={custProjects}
              logCategories={logCategories}
              signals={signals
                .filter((s) => s.resourceId === person.id)
                .sort((a, b) => (a.month < b.month ? -1 : 1))}
              onSignal={(saved) =>
                setSignals((prev) => {
                  const rest = prev.filter(
                    (s) => !(s.resourceId === saved.resourceId && s.month === saved.month)
                  );
                  return [...rest, saved];
                })
              }
              entries={entries
                .filter((l) => l.resourceId === person.id)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))}
              onEntryCreated={(created) => setEntries((prev) => [created, ...prev])}
              onEntryUpdated={(updated) =>
                setEntries((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
