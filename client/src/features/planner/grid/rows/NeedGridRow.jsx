import { useMemo } from 'react';
import NeedCell from '../cells/NeedCell';
import AssignmentBar from '../bars/AssignmentBar';
import { computeNeedFulfillment } from '../../../../lib/gridUtils';
import { resourceMatchesNeed } from '../../../../lib/resourceUtils';
import { monthRange } from '../../../../lib/dateUtils';
import { BH } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

export default function NeedGridRow({ need, project, months, heldResource, onCellClick, onBarClick, onHeightChange }) {
  const { assignments, resources } = useData();
  const nf = useMemo(() => computeNeedFulfillment(need, assignments), [need, assignments]);
  const projMonths = useMemo(() => monthRange(project.startMonth, project.endMonth), [project]);
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
      {months.map((m) => {
        const inRange = needMonths.includes(m);
        const inProject = projMonths.includes(m);
        const info = nf[m] || { needed: 0, filled: 0 };

        return (
          <NeedCell
            key={m} month={m}
            needed={info.needed} filled={info.filled}
            inRange={inRange || inProject}
            canPlace={canHeldPlace && inRange ? true : canHeldPlace === false ? false : undefined}
            onClick={(e) => onCellClick(need, m, e)}
          />
        );
      })}
      {/* Assignment bars overlay */}
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
