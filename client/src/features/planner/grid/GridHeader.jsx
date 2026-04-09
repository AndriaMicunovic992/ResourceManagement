import GridHeaderCell from './GridHeaderCell';

export default function GridHeader({ months, isColumnFullyStaffed }) {
  return (
    <div className="flex border-b-2 border-border sticky top-0 z-10 bg-[#FAFBFD]">
      {months.map((m) => (
        <GridHeaderCell key={m} month={m} isFullyStaffed={isColumnFullyStaffed(m)} />
      ))}
    </div>
  );
}
