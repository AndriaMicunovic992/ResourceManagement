import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HoverButtons from '../../../../components/ui/HoverButtons';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { isCustomerOk } from '../../../../lib/gridUtils';
import { ACCENT_COLORS } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';
import { useVisibility } from '../../../../contexts/VisibilityContext';

export default function CustomerLabel({ customer, index, onEdit, onDelete, onAddProject, canEdit }) {
  const { projects, needs, assignments } = useData();
  const { canViewCustomer } = useVisibility();
  const navigate = useNavigate();
  const canOpen = canViewCustomer(customer.id);

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
      {canOpen ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/customers/${customer.id}`);
          }}
          className="text-sm font-bold text-text truncate flex-1 text-left bg-transparent border-0 p-0 cursor-pointer hover:text-primary hover:underline"
        >
          {customer.name}
        </button>
      ) : (
        <span className="text-sm font-bold text-text truncate flex-1">{customer.name}</span>
      )}
      <StatusBadge status={customer.status} />
      <span className="text-[10px] text-text-light font-mono">{projCount}p</span>
      {canEdit && (
        <>
          <button onClick={onAddProject}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-primary bg-primary-light border-0 rounded px-1 cursor-pointer hover:opacity-80">+</button>
          <HoverButtons onEdit={onEdit} onDelete={onDelete} size="small" />
        </>
      )}
    </div>
  );
}
