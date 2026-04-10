import BarAvatar from './BarAvatar';
import { firstName } from '../../../../lib/resourceUtils';
import { CW } from '../../../../lib/constants';

export default function AssignmentSegment({ segment, resource, domainColor, barHeight = 24, isFirst, isLast, totalSegments, onClick }) {
  const width = segment.months.length * CW;

  return (
    <div
      className="flex items-center gap-1 px-1 cursor-pointer hover:opacity-90"
      style={{
        width,
        height: barHeight,
        backgroundColor: domainColor + '18',
        borderTop: `1.5px solid ${domainColor}40`,
        borderBottom: `1.5px solid ${domainColor}40`,
        borderLeft: isFirst ? `1.5px solid ${domainColor}40` : `1px dashed ${domainColor}35`,
        borderRight: isLast ? `1.5px solid ${domainColor}40` : 'none',
        borderRadius: isFirst && isLast ? 12 : isFirst ? '12px 0 0 12px' : isLast ? '0 12px 12px 0' : 0,
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
