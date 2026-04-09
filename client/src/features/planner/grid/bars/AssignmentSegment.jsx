import BarAvatar from './BarAvatar';
import { firstName } from '../../../../lib/resourceUtils';
import { CW, BH } from '../../../../lib/constants';

export default function AssignmentSegment({ segment, resource, domainColor, isFirst, isLast, totalSegments, onClick }) {
  const width = segment.months.length * CW;

  return (
    <div
      className="flex items-center gap-1 px-1 cursor-pointer hover:opacity-90"
      style={{
        width,
        height: BH,
        backgroundColor: domainColor + '22',
        borderTop: `2px solid ${domainColor}55`,
        borderBottom: `2px solid ${domainColor}55`,
        borderLeft: isFirst ? `2px solid ${domainColor}55` : 'none',
        borderRight: isLast ? `2px solid ${domainColor}55` : 'none',
        borderRadius: isFirst && isLast ? 14 : isFirst ? '14px 4px 4px 14px' : isLast ? '4px 14px 14px 4px' : '4px',
        boxShadow: `0 2px 8px ${domainColor}15`,
      }}
      onClick={onClick}
    >
      {isFirst && (
        <>
          <BarAvatar name={resource.name} color={domainColor} />
          <span className="text-[10px] font-semibold truncate" style={{ color: domainColor }}>
            {firstName(resource.name)}
          </span>
        </>
      )}
      <div className="flex-1" />
      <span className="text-[9px] font-mono px-1 rounded shrink-0"
        style={{ backgroundColor: domainColor + '15', color: domainColor }}>
        {segment.fte.toFixed(1)}
      </span>
    </div>
  );
}
