import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useData } from '../../../contexts/DataContext';
import { currentMonth, addMonths, monthRange } from '../../../lib/dateUtils';
import TimeRangePicker from '../../planner/toolbar/TimeRangePicker';
import { useVisibility } from '../../../contexts/VisibilityContext';
import { PlayIcon } from '../../../components/ui/icons';

export default function CustomerPeople() {
  const { customer } = useOutletContext();
  const { projects, needs, assignments, resources } = useData();
  const { isAdmin, responsibleCustomerIds } = useVisibility();
  const canReview = isAdmin || responsibleCustomerIds.has(customer.id);
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [startingReview, setStartingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    api
      .listCustomerReviews(customer.id)
      .then((data) => {
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canReview, customer.id]);

  const handleStartReview = async () => {
    setStartingReview(true);
    setReviewError('');
    try {
      const created = await api.createCustomerReview(customer.id);
      navigate(`/customers/${customer.id}/reviews/${created.id}/cockpit`);
    } catch (err) {
      setReviewError(err.message || 'Failed to start review');
      setStartingReview(false);
    }
  };

  // "Currently" = allocated in the month window right now; "Ever" = any month
  // within the selected range. Default range is the last 12 months.
  const [mode, setMode] = useState('currently');
  const defaultStart = addMonths(currentMonth(), -11);
  const defaultEnd = currentMonth();
  const [timeRange, setTimeRange] = useState({ start: defaultStart, end: defaultEnd });

  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);

  const custNeedIds = useMemo(() => {
    const projIds = new Set(projects.filter((p) => p.customerId === customer.id).map((p) => p.id));
    return new Set(needs.filter((n) => projIds.has(n.projectId)).map((n) => n.id));
  }, [customer.id, projects, needs]);

  // Aggregate allocation per resource across the selected months. "Currently"
  // uses only the current month; "Ever" sums across all selected months.
  const rows = useMemo(() => {
    const monthsForMode = mode === 'currently' ? [currentMonth()] : months;
    if (monthsForMode.length === 0) return [];

    const byPerson = new Map();
    for (const a of assignments) {
      if (!custNeedIds.has(a.needId)) continue;
      let total = 0;
      for (const m of monthsForMode) {
        total += (a.monthAllocations || {})[m] || 0;
      }
      if (total <= 0) continue;
      const existing = byPerson.get(a.resourceId) || { total: 0, monthsTouched: new Set() };
      existing.total += total;
      for (const m of monthsForMode) {
        if (((a.monthAllocations || {})[m] || 0) > 0) existing.monthsTouched.add(m);
      }
      byPerson.set(a.resourceId, existing);
    }

    const list = [];
    for (const [id, agg] of byPerson.entries()) {
      const person = resources.find((r) => r.id === id);
      if (!person) continue;
      list.push({
        resource: person,
        total: agg.total,
        monthsTouched: agg.monthsTouched.size,
      });
    }
    list.sort((a, b) => b.total - a.total || a.resource.name.localeCompare(b.resource.name));
    return list;
  }, [mode, months, assignments, custNeedIds, resources]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 bg-bg-subtle rounded-lg border border-border">
          {[
            { key: 'currently', label: 'Currently allocated' },
            { key: 'ever', label: 'Ever allocated' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer border transition ${
                mode === opt.key
                  ? 'bg-white text-primary border-border shadow-sm'
                  : 'bg-transparent text-text-mid border-transparent hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'ever' && (
            <TimeRangePicker timeRange={timeRange} onChange={setTimeRange} />
          )}
          {canReview && (
            <button
              onClick={handleStartReview}
              disabled={startingReview}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary border-0 rounded px-3 py-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50"
            >
              <PlayIcon size={11} /> {startingReview ? 'Starting…' : 'Start PM review'}
            </button>
          )}
        </div>
      </div>

      {reviewError && (
        <div className="text-xs text-danger bg-danger-bg p-2 rounded">{reviewError}</div>
      )}

      {canReview && reviews.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-card p-4">
          <h3 className="text-xs font-bold text-text uppercase tracking-wider m-0 mb-2">
            Past PM reviews
          </h3>
          <div className="space-y-1">
            {reviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-primary-bg/40">
                <span className="text-xs text-text">
                  {new Date(r.reviewDate).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                  <span className="text-text-light"> · by {r.authorUser?.name || '—'}</span>
                </span>
                <button
                  onClick={() => navigate(`/customers/${customer.id}/reviews/${r.id}/cockpit`)}
                  className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-border shadow-card p-8 text-center text-sm text-text-light">
          No people allocated to this customer in the selected window.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle">
              <tr className="text-left text-[11px] text-text-mid uppercase tracking-wider">
                <th className="px-4 py-2 font-semibold">Person</th>
                <th className="px-4 py-2 font-semibold text-right">Total FTE·month</th>
                {mode === 'ever' && (
                  <th className="px-4 py-2 font-semibold text-right">Months</th>
                )}
                <th className="px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ resource, total, monthsTouched }) => (
                <tr key={resource.id} className="border-t border-border">
                  <td className="px-4 py-2 font-semibold text-text">{resource.name}</td>
                  <td className="px-4 py-2 font-mono text-right text-text-mid">
                    {total.toFixed(1)}
                  </td>
                  {mode === 'ever' && (
                    <td className="px-4 py-2 font-mono text-right text-text-mid">
                      {monthsTouched}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => navigate(`/people/${resource.id}`)}
                      className="text-xs font-semibold text-primary bg-transparent border border-primary rounded px-2 py-1 cursor-pointer hover:bg-primary hover:text-white"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
