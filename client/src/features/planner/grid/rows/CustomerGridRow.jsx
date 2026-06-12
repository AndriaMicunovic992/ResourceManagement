import { CW } from '../../../../lib/constants';

export default function CustomerGridRow({ customer, index, periods }) {
  // Grid side stays clean — the customer's accent lives in the label column.
  return (
    <div className="flex h-10 mt-2">
      {periods.map((p) => (
        <div key={p.label} className="shrink-0" style={{ width: p.months.length * CW }} />
      ))}
    </div>
  );
}
