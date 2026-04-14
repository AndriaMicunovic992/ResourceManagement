import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useData } from '../../../contexts/DataContext';
import { currentMonth, addMonths, monthRange } from '../../../lib/dateUtils';
import TimeRangePicker from '../../planner/toolbar/TimeRangePicker';

export default function CustomerPeople() {
  const { customer } = useOutletContext();
  const { projects, needs, assignments, resources } = useData();
  const navigate = useNavigate();

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
        {mode === 'ever' && (
          <TimeRangePicker timeRange={timeRange} onChange={setTimeRange} />
        )}
      </div>

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
                      className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
                    >
                      Open ›
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
