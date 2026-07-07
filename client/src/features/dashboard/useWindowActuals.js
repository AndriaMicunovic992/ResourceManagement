import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { currentMonth } from '../../lib/dateUtils';

const EMPTY = { byResource: {}, byCustomer: {}, byProject: {} };

/**
 * Synced Tempo actuals for the Insights window, keyed three ways:
 * byResource / byCustomer / byProject → { [id]: { "YYYY-MM": hours } }.
 * Worklogs only exist up to the current month, so the fetch is clamped there —
 * a window entirely in the future skips the requests. `hasActuals` is true when
 * any hours came back; without it the heatmaps hide their actual layer.
 */
export function useWindowActuals(months) {
  const [data, setData] = useState(EMPTY);
  const from = months[0];
  const last = months[months.length - 1];
  const cur = currentMonth();
  const to = last && last > cur ? cur : last;

  useEffect(() => {
    if (!from || !to || from > to) {
      setData(EMPTY);
      return;
    }
    let dead = false;
    Promise.all([
      api.getMonthlyActuals(from, to).catch(() => ({})),
      api.getMonthlyActualsByCustomer(from, to).catch(() => ({})),
      api.getMonthlyActualsByProject(from, to).catch(() => ({})),
    ]).then(([byResource, byCustomer, byProject]) => {
      if (!dead) setData({ byResource: byResource || {}, byCustomer: byCustomer || {}, byProject: byProject || {} });
    });
    return () => { dead = true; };
  }, [from, to]);

  const hasActuals = useMemo(
    () =>
      [data.byResource, data.byCustomer].some((group) =>
        Object.values(group).some((byMonth) => Object.values(byMonth).some((h) => h > 0))
      ),
    [data]
  );

  return { ...data, hasActuals };
}
