import HoverButtons from '../../../../components/ui/HoverButtons';
import RoleBadge from '../../../../components/badges/RoleBadge';
import { isNeedOk, computeNeedFulfillment } from '../../../../lib/gridUtils';
import { initials } from '../../../../lib/resourceUtils';
import { useData } from '../../../../contexts/DataContext';
import { useMemo } from 'react';

/** Sidebar need-card: role tag + label, assigned-people avatar cluster, and —
 * when unfilled — a dashed amber treatment with an inline ✦ Suggest chip. */
export default function NeedLabel({ need, project, customer, onEdit, onDelete, onSuggest, canEdit, height }) {
  const { assignments, resources } = useData();
  const ok = useMemo(() => isNeedOk(need, assignments), [need, assignments]);
  const isPotential = customer.status === 'potential' || project.status === 'potential' || need.status === 'potential';

  const assigned = useMemo(() => {
    const ids = assignments
      .filter((a) => a.needId === need.id && Object.values(a.monthAllocations || {}).some((v) => v > 0))
      .map((a) => a.resourceId);
    return [...new Set(ids)].map((id) => resources.find((r) => r.id === id)).filter(Boolean);
  }, [assignments, resources, need.id]);

  const openFte = useMemo(() => {
    if (ok) return 0;
    const nf = computeNeedFulfillment(need, assignments);
    const gaps = Object.keys(need.monthAllocations || {})
      .map((m) => Math.max(0, (nf[m]?.needed || 0) - (nf[m]?.filled || 0)))
      .filter((g) => g > 0.001);
    // Max, not average — averages mislead when the demand varies by month.
    return gaps.length ? Math.max(...gaps) : 0;
  }, [ok, need, assignments]);

  return (
    <div className="flex items-stretch" style={{ height: height || 56, paddingLeft: 22, paddingRight: 8 }}>
      <div
        className="group flex items-center gap-1.5 flex-1 min-h-0 overflow-hidden my-[3px] rounded-xl px-2.5 bg-white"
        style={{
          border: ok ? '1px solid #F1F5F9' : '1.5px dashed #F5C872',
          boxShadow: ok ? '0 3px 10px rgba(44,62,80,0.06)' : 'none',
          opacity: isPotential ? 0.7 : 1,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <RoleBadge domain={need.domain} role={need.role} seniority={need.seniority} small />
            {isPotential && (
              <span className="text-[8px] font-bold px-1 py-0 rounded bg-warning-bg text-warning">POT</span>
            )}
          </div>
          {(need.label || openFte > 0) && (
            <div className="text-[9.5px] font-mono text-text-light truncate mt-0.5">
              {need.label}
              {need.label && openFte > 0 && ' · '}
              {openFte > 0 && <span className="text-warning font-bold">{openFte.toFixed(1)} FTE open</span>}
            </div>
          )}
        </div>
        {!ok && canEdit && onSuggest && (
          <button
            onClick={(e) => { e.stopPropagation(); onSuggest(e); }}
            className="text-[9px] font-bold text-primary bg-primary-light border-0 rounded-full px-2 py-0.5 cursor-pointer hover:bg-primary hover:text-white transition shrink-0"
          >
            ✦ Suggest
          </button>
        )}
        {assigned.length > 0 && (
          <div className="flex shrink-0">
            {assigned.slice(0, 3).map((r) => (
              <span
                key={r.id}
                title={r.name}
                className="w-[18px] h-[18px] rounded-full border-2 border-white -ml-1.5 first:ml-0 flex items-center justify-center text-white text-[7px] font-bold bg-text-mid"
              >
                {initials(r.name)}
              </span>
            ))}
            {assigned.length > 3 && (
              <span className="w-[18px] h-[18px] rounded-full border-2 border-white -ml-1.5 flex items-center justify-center text-[7px] font-bold bg-border text-text-mid">
                +{assigned.length - 3}
              </span>
            )}
          </div>
        )}
        {canEdit && <HoverButtons onEdit={onEdit} onDelete={onDelete} size="small" />}
      </div>
    </div>
  );
}
