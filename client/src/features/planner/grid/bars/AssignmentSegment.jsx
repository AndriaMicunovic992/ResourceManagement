import BarAvatar from './BarAvatar';
import { firstName } from '../../../../lib/resourceUtils';
import { CW } from '../../../../lib/constants';

export default function AssignmentSegment({ segment, resource, domainColor, barHeight = 24, isFirst, isLast, totalSegments, onClick }) {
  const width = segment.months.length * CW - 2;

  return (
    <div
      className="flex items-center gap-1 px-1 cursor-pointer hover:opacity-90"
      style={{
        width,
        height: barHeight,
        backgroundColor: domainColor + '18',
        border: `1.5px solid ${domainColor}40`,
        borderLeft: isFirst ? `1.5px solid ${domainColor}40` : 'none',
        borderRight: isLast ? `1.5px solid ${domainColor}40` : 'none',
        borderRadius: isFirst && isLast ? 12 : isFirst ? '12px 3px 3px 12px' : isLast ? '3px 12px 12px 3px' : '3px',
      }}
      onClick={onClick}
    >
      {isFirst && (
        <>
          <BarAvatar name={resource.name} color={domainColor} size={18} />
          <span className="text-[9px] font-semibold truncate" style={{ color: domainColor }}>
            {firstName(resource.name)}
          </span>
        </>
      )}
      <div className="flex-1" />
      <span className="text-[8px] font-mono px-0.5 rounded shrink-0"
        style={{ backgroundColor: domainColor + '15', color: domainColor }}>
        {segment.fte.toFixed(1)}
      </span>
    </div>
  );
}
