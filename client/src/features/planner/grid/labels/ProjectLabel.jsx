import HoverButtons from '../../../../components/ui/HoverButtons';
import StatusBadge from '../../../../components/ui/StatusBadge';
import { isProjectOk } from '../../../../lib/gridUtils';
import { formatMonth } from '../../../../lib/dateUtils';
import { useData } from '../../../../contexts/DataContext';
import { useMemo } from 'react';

export default function ProjectLabel({ project, customer, onEdit, onDelete, onAddNeed, canEdit }) {
  const { needs, assignments, resources } = useData();
  const ok = useMemo(() => isProjectOk(project, needs, assignments), [project, needs, assignments]);
  const hasNeeds = needs.some((n) => n.projectId === project.id);
  const isPotential = customer.status === 'potential' || project.status === 'potential';
  const borderColor = isPotential ? '#F5A62330' : '#D8E8EF';
  const responsible = project.responsiblePersonId ? resources.find((r) => r.id === project.responsiblePersonId) : null;

  return (
    <div className="group flex items-center gap-1.5 h-[34px]" style={{ paddingLeft: 28, borderLeft: `4px solid ${borderColor}`, opacity: isPotential ? 0.7 : 1 }}>
      {(ok || hasNeeds) && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-success' : 'bg-warning'}`} />}
      <span className="text-xs font-semibold text-text-mid truncate flex-1">
        {project.name}
        {responsible && <span className="text-[9px] font-normal text-text-light ml-1">({responsible.name})</span>}
      </span>
      <span className="text-[9px] font-mono text-text-light mr-1">{formatMonth(project.startMonth)}</span>
      <StatusBadge status={project.status} small />
      {canEdit && (
        <>
          <button onClick={onAddNeed}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-primary bg-primary-light border-0 rounded px-1 cursor-pointer hover:opacity-80">+</button>
          <HoverButtons onEdit={onEdit} onDelete={onDelete} size="small" />
        </>
      )}
    </div>
  );
}
