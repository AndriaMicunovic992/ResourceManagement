import { useMemo } from 'react';
import NeedCell from '../cells/NeedCell';
import AssignmentBar from '../bars/AssignmentBar';
import { computeNeedFulfillment } from '../../../../lib/gridUtils';
import { resourceMatchesNeed } from '../../../../lib/resourceUtils';
import { monthRange } from '../../../../lib/dateUtils';
import { CW } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

export default function NeedGridRow({ need, project, months, periods, heldResource, rowHeight, onCellClick, onBarClick }) {
  const { assignments, resources } = useData();
  const nf = useMemo(() => computeNeedFulfillment(need, assignments), [need, assignments]);
  const needMonths = useMemo(() => {
    const s = need.startMonth || project.startMonth;
    const e = need.endMonth || project.endMonth;
    return monthRange(s, e);
  }, [need, project]);

  const visibleAssignments = useMemo(() =>
    assignments.filter((a) => a.needId === need.id && Object.values(a.monthAllocations || {}).some((v) => v > 0)),
    [assignments, need.id]);

  const canHeldPlace = heldResource && resourceMatchesNeed(heldResource, need);
  const barH = 24;
  const barGap = 2;
  const height = rowHeight || 42;

  // Held person's free capacity per month (across all their assignments) —
  // shown as a hint in placeable cells.
  const heldFreeFor = useMemo(() => {
    if (!heldResource) return null;
    const own = assignments.filter((a) => a.resourceId === heldResource.id);
    const cap = heldResource.capacity ?? 1;
    return (m) =>
      cap - own.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
  }, [heldResource, assignments]);

  return (
    <div className="flex relative overflow-hidden" style={{ minHeight: height }}>
      {periods.map((p) => {
        const periodInRange = p.months.some((m) => needMonths.includes(m));
        // Aggregate needed/filled for the period
        const needed = p.months.reduce((sum, m) => sum + (nf[m]?.needed || 0), 0) / p.months.length;
        const filled = p.months.reduce((sum, m) => sum + (nf[m]?.filled || 0), 0) / p.months.length;
        // For placement, use the first in-range month in this period
        const firstInRangeMonth = p.months.find((m) => needMonths.includes(m));

        const inRangeMonths = p.months.filter((m) => needMonths.includes(m));
        return (
          <NeedCell
            key={p.label}
            width={p.months.length * CW}
            needed={needed} filled={filled}
            inRange={periodInRange}
            canPlace={!heldResource ? undefined : canHeldPlace && periodInRange ? true : false}
            heldFree={
              canHeldPlace && periodInRange && firstInRangeMonth && heldFreeFor
                ? heldFreeFor(firstInRangeMonth)
                : null
            }
            onClick={(e) => firstInRangeMonth && onCellClick(need, firstInRangeMonth, inRangeMonths, e)}
          />
        );
      })}
      {/* Assignment bars overlay — always positioned by raw month index */}
      {visibleAssignments.map((a, idx) => {
        const resource = resources.find((r) => r.id === a.resourceId);
        if (!resource) return null;
        // Months where this person's TOTAL load (all projects) exceeds their
        // capacity — surfaced as a red tick on the bar.
        const cap = resource.capacity ?? 1;
        const own = assignments.filter((x) => x.resourceId === a.resourceId);
        const overloadMonths = new Set(
          months.filter(
            (m) => own.reduce((s, x) => s + ((x.monthAllocations || {})[m] || 0), 0) > cap + 0.001
          )
        );
        return (
          <div key={a.id} className="absolute left-0 right-0" style={{ top: idx * (barH + barGap) + 2 }}>
            <AssignmentBar
              assignment={a} need={need} resource={resource} months={months}
              overloadMonths={overloadMonths}
              onClickSegment={(seg, month, e) => onBarClick(a, seg, month, e)}
            />
          </div>
        );
      })}
    </div>
  );
}
