import GridHeaderCell from './GridHeaderCell';

export default function GridHeader({ periods, isPeriodFullyStaffed, periodGap }) {
  return (
    <div className="flex sticky top-0 z-30 bg-white">
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
