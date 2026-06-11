import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useData } from '../../../contexts/DataContext';
import { useVisibility } from '../../../contexts/VisibilityContext';
import { currentMonth, addMonths, monthRange } from '../../../lib/dateUtils';

const WINDOW_MONTHS = 6;

function ratingClass(r) {
  if (r >= 4) return 'bg-success-bg text-success';
  if (r === 3) return 'bg-warning-bg text-warning';
  return 'bg-danger-bg text-danger';
}

function monthLabel(key) {
  const d = new Date(`${key}-01T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short' });
}

/**
 * Monthly PM-perceived client satisfaction per person on this customer.
 * Visible/editable only for admins and this customer's responsible person —
 * and never for the rated people themselves (server-enforced too).
 */
export default function ClientSignalsSection({ customer }) {
  const { isAdmin, responsibleCustomerIds, loading: visLoading } = useVisibility();
  const { projects, needs, assignments, resources } = useData();

  const canRate = isAdmin || responsibleCustomerIds.has(customer.id);

  const months = useMemo(
    () => monthRange(addMonths(currentMonth(), -(WINDOW_MONTHS - 1)), currentMonth()),
    []
  );

  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // { resourceId, month, rating, note } while a cell editor is open.
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canRate || visLoading) return;
    let cancelled = false;
    setLoading(true);
    api
      .getCustomerSignals(customer.id, { from: months[0], to: months[months.length - 1] })
      .then((data) => {
        if (cancelled) return;
        setSignals(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load signals');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRate, visLoading, customer.id, months]);

  const byCell = useMemo(() => {
    const map = new Map();
    for (const s of signals) map.set(`${s.resourceId}|${s.month}`, s);
    return map;
  }, [signals]);

  // People allocated to this customer in the window, plus anyone who already
  // has a signal (so departed people keep their history visible).
  const people = useMemo(() => {
    const projIds = new Set(
      projects.filter((p) => p.customerId === customer.id).map((p) => p.id)
    );
    const needIds = new Set(needs.filter((n) => projIds.has(n.projectId)).map((n) => n.id));
    const ids = new Set();
    for (const a of assignments) {
      if (!needIds.has(a.needId)) continue;
      const alloc = a.monthAllocations || {};
      if (months.some((m) => (alloc[m] || 0) > 0)) ids.add(a.resourceId);
    }
    for (const s of signals) ids.add(s.resourceId);
    return Array.from(ids)
      .map((id) => resources.find((r) => r.id === id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, needs, assignments, resources, customer.id, months, signals]);

  if (visLoading || !canRate) return null;

  const handleCellClick = (resourceId, month) => {
    const existing = byCell.get(`${resourceId}|${month}`);
    setEditing({
      resourceId,
      month,
      rating: existing?.rating ?? null,
      note: existing?.note ?? '',
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.rating) return;
    setSaving(true);
    setError('');
    try {
      const saved = await api.upsertCustomerSignal(customer.id, {
        resourceId: editing.resourceId,
        month: editing.month,
        rating: editing.rating,
        note: editing.note.trim() ? editing.note : null,
      });
      setSignals((prev) => {
        const rest = prev.filter(
          (s) => !(s.resourceId === saved.resourceId && s.month === saved.month)
        );
        return [...rest, saved];
      });
      setEditing(null);
    } catch (err) {
      setError(err.message || 'Failed to save signal');
    }
    setSaving(false);
  };

  const editingPerson = editing ? resources.find((r) => r.id === editing.resourceId) : null;

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-bold text-text uppercase tracking-wider m-0">
          Client satisfaction signals
        </h3>
        <p className="text-[10px] text-text-light mt-0.5 mb-0">
          Your monthly read (1–5) of how the client feels about each person's work. One entry per
          month — not visible to the rated person.
        </p>
      </div>
      {error && (
        <div className="mx-4 my-2 text-xs text-danger bg-danger-bg p-2 rounded">{error}</div>
      )}
      {loading ? (
        <div className="p-6 text-center text-xs text-text-light">Loading…</div>
      ) : people.length === 0 ? (
        <div className="p-6 text-center text-xs text-text-light">
          No people allocated to this customer in the last {WINDOW_MONTHS} months.
        </div>
      ) : (
        <table className="w-full text-sm mt-1">
          <thead className="bg-bg-subtle">
            <tr className="text-[11px] text-text-mid uppercase tracking-wider">
              <th className="px-4 py-2 font-semibold text-left">Person</th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 font-semibold text-center">
                  {monthLabel(m)}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold text-center">Avg</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const ratings = months
                .map((m) => byCell.get(`${person.id}|${m}`)?.rating)
                .filter((r) => r != null);
              const avg = ratings.length
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                : null;
              return (
                <tr key={person.id} className="border-t border-border-light">
                  <td className="px-4 py-1.5 font-semibold text-text text-xs">{person.name}</td>
                  {months.map((m) => {
                    const signal = byCell.get(`${person.id}|${m}`);
                    return (
                      <td key={m} className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => handleCellClick(person.id, m)}
                          title={signal?.note || 'Set rating'}
                          className={`w-8 h-7 rounded text-xs font-bold cursor-pointer border ${
                            signal
                              ? `${ratingClass(signal.rating)} border-transparent`
                              : 'bg-white text-text-light border-dashed border-border hover:border-primary'
                          }`}
                        >
                          {signal ? signal.rating : '+'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-center font-mono text-xs text-text-mid">
                    {avg != null ? avg.toFixed(1) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editing && (
        <div className="border-t border-border bg-primary-bg/40 px-4 py-3">
          <div className="text-[11px] font-semibold text-text mb-2">
            {editingPerson?.name} — {monthLabel(editing.month)} {editing.month.slice(0, 4)}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEditing((e) => ({ ...e, rating: n }))}
                  className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer ${
                    editing.rating === n
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-mid border-border hover:border-primary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={editing.note}
              onChange={(e) => setEditing((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Optional note (visible on hover)"
              maxLength={2000}
              className="flex-1 min-w-[180px] px-2 py-1.5 border border-border rounded text-xs text-text outline-none focus:border-primary bg-white"
            />
            <button
              onClick={handleSave}
              disabled={saving || !editing.rating}
              className="text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="text-xs font-semibold text-text-mid bg-transparent border border-border rounded px-3 py-1.5 cursor-pointer hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
