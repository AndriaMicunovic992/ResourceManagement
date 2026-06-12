import GridHeaderCell from './GridHeaderCell';

export default function GridHeader({ periods, isPeriodFullyStaffed, periodGap }) {
  return (
    <div className="flex border-b-2 border-border sticky z-10 bg-white" style={{ top: 53 }}>
      {periods.map((p) => (
        <GridHeaderCell
          key={p.label}
          period={p}
          isFullyStaffed={isPeriodFullyStaffed(p.months)}
          gap={periodGap ? periodGap(p.months) : 0}
        />
      ))}
    </div>
  );
}
