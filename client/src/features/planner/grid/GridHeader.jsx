import GridHeaderCell from './GridHeaderCell';

export default function GridHeader({ periods, isPeriodFullyStaffed }) {
  return (
    <div className="flex border-b-2 border-border sticky top-0 z-10 bg-[#FAFBFD]">
      {periods.map((p) => (
        <GridHeaderCell key={p.label} period={p} isFullyStaffed={isPeriodFullyStaffed(p.months)} />
      ))}
    </div>
  );
}
