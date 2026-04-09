import { useMemo } from 'react';
import NeedCell from '../cells/NeedCell';
import AssignmentBar from '../bars/AssignmentBar';
import { computeNeedFulfillment } from '../../../../lib/gridUtils';
import { resourceMatchesNeed } from '../../../../lib/resourceUtils';
import { monthRange } from '../../../../lib/dateUtils';
import { BH, CW } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

export default function NeedGridRow({ need, project, months, periods, heldResource, onCellClick, onBarClick }) {
  const { assignments, resources } = useData();
  const nf = useMemo(() => computeNeedFulfillment(need, assignments), [need, assignments]);
  const needMonths = useMemo(() => {
    const s = need.startMonth || project.startMonth;
    const e = need.endMonth || project.endMonth;
    return monthRange(s, e);
  }, [need, project]);

  const needAssignments = useMemo(() =>
    assignments.filter((a) => a.needId === need.id), [assignments, need.id]);

  const barCount = needAssignments.filter((a) =>
    Object.values(a.monthAllocations || {}).some((v) => v > 0)
  ).length;
  const rowHeight = Math.max(42, barCount * (BH + 4) + 14);

  const canHeldPlace = heldResource && resourceMatchesNeed(heldResource, need);

  return (
    <div className="flex relative" style={{ minHeight: rowHeight }}>
      {periods.map((p) => {
        const periodInRange = p.months.some((m) => needMonths.includes(m));
        // Aggregate needed/filled for the period
        const needed = p.months.reduce((sum, m) => sum + (nf[m]?.needed || 0), 0) / p.months.length;
        const filled = p.months.reduce((sum, m) => sum + (nf[m]?.filled || 0), 0) / p.months.length;
        // For placement, use the first in-range month in this period
        const firstInRangeMonth = p.months.find((m) => needMonths.includes(m));

        return (
          <NeedCell
            key={p.label}
            width={p.months.length * CW}
            needed={needed} filled={filled}
            inRange={periodInRange}
            canPlace={canHeldPlace && periodInRange ? true : canHeldPlace === false ? false : undefined}
            onClick={(e) => firstInRangeMonth && onCellClick(need, firstInRangeMonth, e)}
          />
        );
      })}
      {/* Assignment bars overlay — always positioned by raw month index */}
      {needAssignments.map((a, idx) => {
        const resource = resources.find((r) => r.id === a.resourceId);
        if (!resource) return null;
        return (
          <div key={a.id} className="absolute left-0 right-0" style={{ top: idx * (BH + 4) + 2 }}>
            <AssignmentBar
              assignment={a} need={need} resource={resource} months={months}
              onClickSegment={(seg, e) => onBarClick(a, seg, e)}
            />
          </div>
        );
      })}
    </div>
  );
}
