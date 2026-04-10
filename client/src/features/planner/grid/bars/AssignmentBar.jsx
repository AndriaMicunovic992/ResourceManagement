import { useMemo } from 'react';
import AssignmentSegment from './AssignmentSegment';
import { buildSegments } from '../../../../lib/gridUtils';
import { domainColor } from '../../../../lib/resourceUtils';
import { CW } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

const BAR_H = 24;

export default function AssignmentBar({ assignment, need, resource, months, onClickSegment }) {
  const { deleteAssignment } = useData();
  const segments = useMemo(() => buildSegments(assignment), [assignment]);
  const color = domainColor(need.domain);

  if (segments.length === 0) return null;

  const firstMonth = segments[0].start;
  const startIdx = months.indexOf(firstMonth);
  if (startIdx < 0) return null;

  return (
    <div className="absolute flex items-center group/bar" style={{ left: startIdx * CW + 1, top: 0, height: BAR_H }}>
      {segments.map((seg, i) => (
        <AssignmentSegment
          key={i} segment={seg} resource={resource} domainColor={color}
          barHeight={BAR_H}
          isFirst={i === 0} isLast={i === segments.length - 1}
          totalSegments={segments.length}
          onClick={(e) => { e.stopPropagation(); onClickSegment(seg, e); }}
        />
      ))}
      <button
        onClick={(e) => { e.stopPropagation(); deleteAssignment(assignment.id); }}
        className="opacity-0 group-hover/bar:opacity-100 absolute right-0 top-0 w-4 flex items-center justify-center text-[8px] text-danger bg-white/80 border-0 cursor-pointer rounded-r-lg hover:bg-danger-bg transition-opacity"
        style={{ height: BAR_H }}
      >
        ✕
      </button>
    </div>
  );
}
