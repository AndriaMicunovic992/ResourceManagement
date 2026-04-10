import { useMemo, useCallback } from 'react';
import AssignmentSegment from './AssignmentSegment';
import ResizeHandle from './ResizeHandle';
import { buildSegments } from '../../../../lib/gridUtils';
import { domainColor } from '../../../../lib/resourceUtils';
import { CW } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

const BAR_H = 24;

export default function AssignmentBar({ assignment, need, resource, months, onClickSegment }) {
  const { deleteAssignment, upsertAssignment } = useData();
  const segments = useMemo(() => buildSegments(assignment), [assignment]);
  const color = domainColor(need.domain);

  const handleResize = useCallback((side) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const allocs = assignment.monthAllocations || {};
    const allMonths = Object.keys(allocs).sort();
    const activeMonths = allMonths.filter((m) => allocs[m] > 0);
    if (activeMonths.length === 0) return;

    const onUp = (upE) => {
      document.removeEventListener('mouseup', onUp);
      const deltaX = upE.clientX - startX;
      const delta = Math.round(deltaX / CW);
      if (delta === 0) return;

      const newAllocs = { ...allocs };
      if (side === 'right') {
        if (delta < 0) {
          // Shrink from right: remove last |delta| active months
          const toRemove = activeMonths.slice(Math.max(1, activeMonths.length + delta));
          toRemove.forEach((m) => { newAllocs[m] = 0; });
        } else {
          // Extend right: add months after last active
          const lastActive = activeMonths[activeMonths.length - 1];
          const lastFte = allocs[lastActive];
          const idx = allMonths.indexOf(lastActive);
          for (let i = 1; i <= delta && idx + i < allMonths.length; i++) {
            newAllocs[allMonths[idx + i]] = lastFte;
          }
        }
      } else {
        if (delta > 0) {
          // Shrink from left: remove first |delta| active months
          const toRemove = activeMonths.slice(0, Math.min(delta, activeMonths.length - 1));
          toRemove.forEach((m) => { newAllocs[m] = 0; });
        } else {
          // Extend left: add months before first active
          const firstActive = activeMonths[0];
          const firstFte = allocs[firstActive];
          const idx = allMonths.indexOf(firstActive);
          for (let i = 1; i <= Math.abs(delta) && idx - i >= 0; i++) {
            newAllocs[allMonths[idx - i]] = firstFte;
          }
        }
      }

      upsertAssignment({
        needId: assignment.needId,
        resourceId: assignment.resourceId,
        monthAllocations: newAllocs,
      });
    };

    document.addEventListener('mouseup', onUp);
  }, [assignment, upsertAssignment]);

  if (segments.length === 0) return null;

  const firstMonth = segments[0].start;
  const startIdx = months.indexOf(firstMonth);
  if (startIdx < 0) return null;

  const allBarMonths = segments.flatMap((s) => s.months);
  const totalWidth = allBarMonths.length * CW;

  return (
    <div className="absolute flex items-center group/bar" style={{ left: startIdx * CW, top: 0, height: BAR_H, width: totalWidth }}>
      <ResizeHandle side="left" onMouseDown={handleResize('left')} />
      {segments.map((seg, i) => (
        <AssignmentSegment
          key={i} segment={seg} resource={resource} domainColor={color}
          barHeight={BAR_H}
          isFirst={i === 0} isLast={i === segments.length - 1}
          totalSegments={segments.length}
          onClick={(e) => { e.stopPropagation(); onClickSegment(seg, e); }}
        />
      ))}
      <ResizeHandle side="right" onMouseDown={handleResize('right')} />
      <button
        onClick={(e) => { e.stopPropagation(); deleteAssignment(assignment.id); }}
        className="opacity-0 group-hover/bar:opacity-100 absolute -right-4 top-0 w-4 flex items-center justify-center text-[8px] text-danger bg-white/80 border-0 cursor-pointer rounded hover:bg-danger-bg transition-opacity"
        style={{ height: BAR_H }}
      >
        ✕
      </button>
    </div>
  );
}
