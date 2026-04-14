import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HeatmapCell from './HeatmapCell';
import ProjectHeatmapRow from './ProjectHeatmapRow';
import Avatar from '../../../components/ui/Avatar';
import StatusBadge from '../../../components/ui/StatusBadge';
import { ACCENT_COLORS } from '../../../lib/constants';
import { useData } from '../../../contexts/DataContext';

export default function CustomerHeatmapRow({ customer, index, months, includePotential }) {
  const [expanded, setExpanded] = useState(false);
  const { projects, needs, assignments, viewableCustomerIds } = useData();
  const navigate = useNavigate();
  const canOpen = Array.isArray(viewableCustomerIds) && viewableCustomerIds.includes(customer.id);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const custProjects = useMemo(() => {
    const all = projects.filter((p) => p.customerId === customer.id);
    if (includePotential) return all;
    return all.filter((p) => p.status === 'realised');
  }, [projects, customer.id, includePotential]);

  const staffingByMonth = useMemo(() => {
    const result = {};
    const custNeeds = needs.filter((n) => {
      if (!custProjects.some((p) => p.id === n.projectId)) return false;
      if (!includePotential && n.status !== 'realised') return false;
      return true;
    });
    for (const m of months) {
      let totalNeeded = 0, totalFilled = 0;
      let hasPotential = false;
      for (const n of custNeeds) {
        const needed = (n.monthAllocations || {})[m] || 0;
        if (needed <= 0) continue;
        const filled = assignments.filter((a) => a.needId === n.id).reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        totalNeeded += needed;
        totalFilled += filled;
        if (n.status === 'potential') hasPotential = true;
        const proj = projects.find((p) => p.id === n.projectId);
        if (proj?.status === 'potential') hasPotential = true;
      }
      result[m] = {
        ratio: totalNeeded > 0 ? totalFilled / totalNeeded : null,
        totalNeeded,
        totalFilled,
        isPotential: hasPotential,
      };
    }
    return result;
  }, [custProjects, needs, assignments, months, includePotential, projects]);

  return (
    <>
      <div className="flex items-center border-b border-border cursor-pointer hover:bg-primary-bg/30"
        style={{ background: customer.status === 'potential' ? '#F9FAFB' : accent + '08' }}
        onClick={() => setExpanded(!expanded)}>
        <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] text-text-mid transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          <Avatar name={customer.name} color={customer.status === 'potential' ? '#9CA3AF' : accent} size={28} className="rounded-lg text-[11px]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {canOpen ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/customers/${customer.id}`);
                  }}
                  className="text-[13px] font-bold text-text truncate bg-transparent border-0 p-0 cursor-pointer hover:text-primary hover:underline text-left"
                >
                  {customer.name}
                </button>
              ) : (
                <span className="text-[13px] font-bold text-text truncate">{customer.name}</span>
              )}
              <StatusBadge status={customer.status} />
            </div>
            <div className="text-[10px] text-text-light">{custProjects.length} projects</div>
          </div>
        </div>
        {months.map((m) => {
          const d = staffingByMonth[m];
          return (
            <HeatmapCell key={m} value={d.ratio} totalNeeded={d.totalNeeded} totalFilled={d.totalFilled}
              isPotential={d.isPotential && includePotential} />
          );
        })}
      </div>
      {expanded && custProjects.map((p) => (
        <ProjectHeatmapRow key={p.id} project={p} customer={customer} months={months} includePotential={includePotential} />
      ))}
    </>
  );
}
