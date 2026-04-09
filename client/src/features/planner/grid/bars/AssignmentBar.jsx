import { useMemo } from 'react';
import AssignmentSegment from './AssignmentSegment';
import ResizeHandle from './ResizeHandle';
import { buildSegments } from '../../../../lib/gridUtils';
import { domainColor } from '../../../../lib/resourceUtils';
import { CW, BH } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

export default function AssignmentBar({ assignment, need, resource, months, onClickSegment, onDelete }) {
  const { deleteAssignment } = useData();
  const segments = useMemo(() => buildSegments(assignment), [assignment]);
  const color = domainColor(need.domain);

  if (segments.length === 0) return null;

  // Calculate position relative to the month columns
  const firstMonth = segments[0].start;
  const allBarMonths = segments.flatMap((s) => s.months);
  const lastMonth = allBarMonths[allBarMonths.length - 1];
  const startIdx = months.indexOf(firstMonth);
  const endIdx = months.indexOf(lastMonth);

  if (startIdx < 0) return null;

  return (
    <div className="absolute flex items-center" style={{ left: startIdx * CW, top: 2, height: BH }}>
      {segments.map((seg, i) => (
        <AssignmentSegment
          key={i} segment={seg} resource={resource} domainColor={color}
          isFirst={i === 0} isLast={i === segments.length - 1}
          totalSegments={segments.length}
          onClick={(e) => { e.stopPropagation(); onClickSegment(seg, e); }}
        />
      ))}
      <button
        onClick={(e) => { e.stopPropagation(); deleteAssignment(assignment.id); }}
        className="ml-0.5 w-4 h-4 flex items-center justify-center text-[8px] text-danger bg-transparent border-0 cursor-pointer rounded hover:bg-danger-bg"
      >
        ✕
      </button>
    </div>
  );
}
