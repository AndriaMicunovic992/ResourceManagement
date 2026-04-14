import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useData } from '../../../contexts/DataContext';
import { currentMonth } from '../../../lib/dateUtils';
import StatusBadge from '../../../components/ui/StatusBadge';

export default function CustomerProjects() {
  const { customer } = useOutletContext();
  const { projects, needs, assignments } = useData();
  const navigate = useNavigate();

  // For each project, compute staffing % for the current month.
  const rows = useMemo(() => {
    const now = currentMonth();
    const custProjects = projects.filter((p) => p.customerId === customer.id);
    return custProjects.map((project) => {
      const projNeeds = needs.filter((n) => n.projectId === project.id);
      let needed = 0;
      let filled = 0;
      for (const n of projNeeds) {
        needed += (n.monthAllocations || {})[now] || 0;
        const filledForNeed = assignments
          .filter((a) => a.needId === n.id)
          .reduce((s, a) => s + ((a.monthAllocations || {})[now] || 0), 0);
        filled += filledForNeed;
      }
      return {
        project,
        needCount: projNeeds.length,
        needed,
        filled,
        ratio: needed > 0 ? filled / needed : null,
      };
    });
  }, [customer.id, projects, needs, assignments]);

  const openInPlanner = () => {
    navigate(`/planner?customerId=${customer.id}`);
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-card p-8 text-center text-sm text-text-light">
        No projects for this customer yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-text-mid uppercase tracking-wider">
          {rows.length} project{rows.length === 1 ? '' : 's'}
        </div>
        <button
          onClick={openInPlanner}
          className="text-[11px] font-semibold text-white bg-primary border-0 rounded-full px-4 py-1.5 cursor-pointer hover:opacity-90"
        >
          Open in planner
        </button>
      </div>
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle">
            <tr className="text-left text-[11px] text-text-mid uppercase tracking-wider">
              <th className="px-4 py-2 font-semibold">Project</th>
              <th className="px-4 py-2 font-semibold text-right">Needs</th>
              <th className="px-4 py-2 font-semibold text-right">Needed (now)</th>
              <th className="px-4 py-2 font-semibold text-right">Staffed (now)</th>
              <th className="px-4 py-2 font-semibold text-right">Fill %</th>
              <th className="px-4 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ project, needCount, needed, filled, ratio }) => (
              <tr key={project.id} className="border-t border-border">
                <td className="px-4 py-2 font-semibold text-text">
                  <span className="inline-flex items-center gap-1.5">
                    {project.name}
                    <StatusBadge status={project.status} small />
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-right text-text-mid">{needCount}</td>
                <td className="px-4 py-2 font-mono text-right text-text-mid">
                  {needed.toFixed(1)}
                </td>
                <td className="px-4 py-2 font-mono text-right text-text-mid">
                  {filled.toFixed(1)}
                </td>
                <td className="px-4 py-2 font-mono text-right text-text-mid">
                  {ratio == null ? '—' : `${Math.round(ratio * 100)}%`}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => navigate(`/planner?projectId=${project.id}`)}
                    className="text-[11px] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline p-0"
                  >
                    Open ›
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
