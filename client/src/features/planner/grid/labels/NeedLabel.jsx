import HoverButtons from '../../../../components/ui/HoverButtons';
import RoleBadge from '../../../../components/badges/RoleBadge';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { isNeedOk } from '../../../../lib/gridUtils';
import { useData } from '../../../../contexts/DataContext';
import { useMemo } from 'react';

export default function NeedLabel({ need, project, customer, onEdit, onDelete, onSuggest, canEdit, height }) {
  const { assignments } = useData();
  const ok = useMemo(() => isNeedOk(need, assignments), [need, assignments]);
  const isPotential = customer.status === 'potential' || project.status === 'potential' || need.status === 'potential';
  return (
    <div className="group flex items-center gap-1.5" style={{ paddingLeft: 42, borderLeft: '4px solid transparent', opacity: isPotential ? 0.65 : 1, minHeight: height || 42 }}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-success' : 'bg-warning'}`} />
      <RoleBadge domain={need.domain} role={need.role} seniority={need.seniority} small />
      {need.label && <span className="text-[10px] text-text-mid truncate">{need.label}</span>}
      <StatusBadge status={need.status} small />
      <div className="flex-1" />
      {canEdit && !ok && onSuggest && (
        <button
          onClick={(e) => { e.stopPropagation(); onSuggest(e); }}
          title="Suggest people for this need"
          className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-primary bg-primary-light border-0 rounded px-1.5 py-0.5 cursor-pointer hover:bg-primary hover:text-white transition"
        >
          ✦
        </button>
      )}
      {canEdit && <HoverButtons onEdit={onEdit} onDelete={onDelete} size="small" />}
    </div>
  );
}
