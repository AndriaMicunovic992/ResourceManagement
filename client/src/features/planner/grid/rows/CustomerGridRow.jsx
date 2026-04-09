import { useMemo } from 'react';
import { CW, ACCENT_COLORS } from '../../../../lib/constants';
import { isCustomerOk } from '../../../../lib/gridUtils';
import { useData } from '../../../../contexts/DataContext';

export default function CustomerGridRow({ customer, index, months }) {
  const { projects, needs, assignments } = useData();
  const ok = useMemo(() => isCustomerOk(customer, projects, needs, assignments), [customer, projects, needs, assignments]);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const bg = ok ? '#EAFAF0' : customer.status === 'potential' ? '#FFF6E8' : accent + '10';

  return (
    <div className="flex h-10" style={{ background: bg }}>
      {months.map((m) => (
        <div key={m} className="shrink-0 border-r border-white/30" style={{ width: CW }} />
      ))}
    </div>
  );
}
