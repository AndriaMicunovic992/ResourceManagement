import GridHeaderCell from './GridHeaderCell';

export default function GridHeader({ periods, isPeriodFullyStaffed, periodGap }) {
  return (
    <div className="flex border-b-2 border-border sticky top-0 z-10 bg-white">
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
