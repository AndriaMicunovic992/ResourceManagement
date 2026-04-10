import { useState, useMemo } from 'react';
import HeatmapCell from './HeatmapCell';
import ProjectHeatmapRow from './ProjectHeatmapRow';
import Avatar from '../../../components/ui/Avatar';
import StatusBadge from '../../../components/ui/StatusBadge';
import { isCustomerOk } from '../../../lib/gridUtils';
import { ACCENT_COLORS } from '../../../lib/constants';
import { useData } from '../../../contexts/DataContext';

export default function CustomerHeatmapRow({ customer, index, months }) {
  const [expanded, setExpanded] = useState(false);
  const { projects, needs, assignments } = useData();
  const ok = useMemo(() => isCustomerOk(customer, projects, needs, assignments), [customer, projects, needs, assignments]);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const custProjects = projects.filter((p) => p.customerId === customer.id);
  const bg = ok ? '#EAFAF008' : customer.status === 'potential' ? '#FFF6E808' : accent + '08';

  const staffingByMonth = useMemo(() => {
    const result = {};
    const custNeeds = needs.filter((n) => custProjects.some((p) => p.id === n.projectId));
    for (const m of months) {
      let totalNeeded = 0, totalFilled = 0;
      for (const n of custNeeds) {
        const needed = (n.monthAllocations || {})[m] || 0;
        const filled = assignments.filter((a) => a.needId === n.id).reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
        totalNeeded += needed;
        totalFilled += filled;
      }
      result[m] = totalNeeded > 0 ? totalFilled / totalNeeded : null;
    }
    return result;
  }, [custProjects, needs, assignments, months]);

  return (
    <>
      <div className="flex items-center border-b border-border cursor-pointer hover:bg-primary-bg/30"
        style={{ background: bg }}
        onClick={() => setExpanded(!expanded)}>
        <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] text-text-mid transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          <Avatar name={customer.name} color={customer.status === 'potential' ? '#F5A623' : accent} size={28} className="rounded-lg text-[11px]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-bold text-text truncate">{customer.name}</span>
              <StatusBadge status={customer.status} />
            </div>
            <div className="text-[10px] text-text-light">{custProjects.length} projects</div>
          </div>
        </div>
        {months.map((m) => (
          <HeatmapCell key={m} value={staffingByMonth[m]} />
        ))}
      </div>
      {expanded && custProjects.map((p) => (
        <ProjectHeatmapRow key={p.id} project={p} customer={customer} months={months} />
      ))}
    </>
  );
}
