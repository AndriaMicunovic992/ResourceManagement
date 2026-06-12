import { CW, ACCENT_COLORS } from '../../../../lib/constants';

export default function CustomerGridRow({ customer, index, periods }) {
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const bg = customer.status === 'potential' ? '#FFF6E8' : accent + '08';

  return (
    <div className="flex h-10 mt-2" style={{ background: bg }}>
      {periods.map((p) => (
        <div key={p.label} className="shrink-0" style={{ width: p.months.length * CW }} />
      ))}
    </div>
  );
}
