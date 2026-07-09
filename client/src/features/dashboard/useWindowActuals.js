import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { currentMonth } from '../../lib/dateUtils';

const EMPTY = { byResource: {}, byResourceType: {}, byCustomer: {}, byProject: {} };

/**
 * Synced Tempo actuals for the Insights window, keyed four ways:
 *  byResource      { [resourceId]: { "YYYY-MM": hours } }   — worked time (absences excluded server-side)
 *  byResourceType  { [resourceId]: { "YYYY-MM": { client|internal|absence: hours } } } — unfiltered
 *  byCustomer / byProject — client-work hours per entity; team-scoped when a
 *  team lens is on (only that team's people's hours), so the client table can
 *  keep its actual layer under a team filter.
 * Worklogs only exist up to the current month, so the fetch is clamped there —
 * a window entirely in the future skips the requests. `hasActuals` is true when
 * any hours came back org-wide; without it the tables hide their actual layer.
 */
export function useWindowActuals(months, teamId = '') {
  const [data, setData] = useState(EMPTY);
  const from = months[0];
  const last = months[months.length - 1];
  const cur = currentMonth();
  const to = last && last > cur ? cur : last;

  // Per-person hours are never team-filtered (consumers slice them client-side).
  useEffect(() => {
    if (!from || !to || from > to) {
      setData(EMPTY);
      return;
    }
    let dead = false;
    Promise.all([
      api.getMonthlyActuals(from, to).catch(() => ({})),
      api.getMonthlyActualsByType(from, to).catch(() => ({})),
    ]).then(([byResource, byResourceType]) => {
      if (!dead) {
        setData((prev) => ({ ...prev, byResource: byResource || {}, byResourceType: byResourceType || {} }));
      }
    });
    return () => { dead = true; };
  }, [from, to]);

  // Entity hours follow the team lens.
  useEffect(() => {
    if (!from || !to || from > to) return;
    let dead = false;
    Promise.all([
      api.getMonthlyActualsByCustomer(from, to, teamId).catch(() => ({})),
      api.getMonthlyActualsByProject(from, to, teamId).catch(() => ({})),
    ]).then(([byCustomer, byProject]) => {
      if (!dead) {
        setData((prev) => ({ ...prev, byCustomer: byCustomer || {}, byProject: byProject || {} }));
      }
    });
    return () => { dead = true; };
  }, [from, to, teamId]);

  const hasActuals = useMemo(
    () =>
      [data.byResource, data.byCustomer].some((group) =>
        Object.values(group).some((byMonth) => Object.values(byMonth).some((h) => h > 0))
      ),
    [data]
  );

  return { ...data, hasActuals, window: { from, to } };
}
