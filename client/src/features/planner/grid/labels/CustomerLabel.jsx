import { useMemo } from 'react';
import HoverButtons from '../../../../components/ui/HoverButtons';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { isCustomerOk } from '../../../../lib/gridUtils';
import { ACCENT_COLORS } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

export default function CustomerLabel({ customer, index, onEdit, onDelete, canEdit }) {
  const { projects, needs, assignments } = useData();

  const ok = useMemo(() => isCustomerOk(customer, projects, needs, assignments), [customer, projects, needs, assignments]);
  const hasNeeds = needs.some((n) => projects.some((p) => p.customerId === customer.id && p.id === n.projectId));
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const borderColor = customer.status === 'potential' ? '#F5A623' : accent;
  const bg = customer.status === 'potential' ? '#FFF6E808' : accent + '08';
  const projCount = projects.filter((p) => p.customerId === customer.id).length;
  const dotColor = ok ? '#5BC68A' : hasNeeds ? '#F5A623' : borderColor;

  return (
    <div className="group flex items-center gap-2 px-3.5 h-10" style={{ borderLeft: `4px solid ${borderColor}`, background: bg }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      <span className="text-sm font-bold text-text truncate flex-1">{customer.name}</span>
      <StatusBadge status={customer.status} />
      <span className="text-[10px] text-text-light font-mono">{projCount}p</span>
      {canEdit && <HoverButtons onEdit={onEdit} onDelete={onDelete} size="small" />}
    </div>
  );
}
