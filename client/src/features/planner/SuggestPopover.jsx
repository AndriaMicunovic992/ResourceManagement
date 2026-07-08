import { useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { resourceMatchesNeed } from '../../lib/resourceUtils';
import { effectiveCapacity } from '../../lib/availability';
import Avatar from '../../components/ui/Avatar';

/**
 * Ranked staffing suggestions for a need: people whose roles match, ordered by
 * how much of the remaining gap they could actually cover over the need's
 * months, with a tiebreak for having worked with this customer before.
 */
export default function SuggestPopover({ need, customer, x, y, onAssign, onClose }) {
  const { resources, assignments, needs, projects } = useData();

  const candidates = useMemo(() => {
    const needAllocs = need.monthAllocations || {};
    const needMonths = Object.keys(needAllocs).filter((m) => needAllocs[m] > 0);
    if (needMonths.length === 0) return [];

    const assignedIds = new Set(
      assignments
        .filter((a) => a.needId === need.id && Object.values(a.monthAllocations || {}).some((v) => v > 0))
        .map((a) => a.resourceId)
    );
    const custProjectIds = new Set(
      projects.filter((p) => p.customerId === customer.id).map((p) => p.id)
    );
    const custNeedIds = new Set(
      needs.filter((n) => custProjectIds.has(n.projectId)).map((n) => n.id)
    );
    const needAssigns = assignments.filter((a) => a.needId === need.id);

    return resources
      .filter((r) => resourceMatchesNeed(r, need) && !assignedIds.has(r.id))
      .map((r) => {
        const own = assignments.filter((a) => a.resourceId === r.id);
        let freeSum = 0;
        let coverSum = 0;
        for (const m of needMonths) {
          const used = own.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
          // Effective capacity: someone on leave doesn't rank as free cover.
          const free = Math.max(0, effectiveCapacity(r, m) - used);
          const filled = needAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
          const gap = Math.max(0, (needAllocs[m] || 0) - filled);
          freeSum += free;
          coverSum += Math.min(free, gap);
        }
        return {
          resource: r,
          freeAvg: freeSum / needMonths.length,
          coverAvg: coverSum / needMonths.length,
          knowsCustomer: own.some((a) => custNeedIds.has(a.needId)),
        };
      })
      .filter((c) => c.freeAvg > 0.01)
      .sort(
        (a, b) =>
          b.coverAvg - a.coverAvg ||
          (b.knowsCustomer ? 1 : 0) - (a.knowsCustomer ? 1 : 0) ||
          b.freeAvg - a.freeAvg
      )
      .slice(0, 5);
  }, [need, customer.id, resources, assignments, needs, projects]);

  return (
    <div
      className="fixed bg-white rounded-xl border border-border shadow-lg p-3 z-[3000] w-[280px]"
      style={{ left: Math.min(x, window.innerWidth - 300), top: Math.min(y, window.innerHeight - 260) }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[10px] font-semibold text-text-mid uppercase tracking-wider mb-2">
        Suggested for {need.domain} {need.role} · {need.seniority}
      </div>
      {candidates.length === 0 ? (
        <div className="text-xs text-text-mid py-2">
          No matching people with free capacity in this window.
        </div>
      ) : (
        <div className="space-y-1.5">
          {candidates.map(({ resource, freeAvg, coverAvg, knowsCustomer }) => (
            <div key={resource.id} className="flex items-center gap-2">
              <Avatar name={resource.name} color="#4CBAD4" size={24} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-text truncate">{resource.name}</div>
                <div className="text-[10px] text-text-mid">
                  +{freeAvg.toFixed(1)} free · covers {coverAvg.toFixed(1)}
                  {knowsCustomer && (
                    <span className="ml-1 px-1 rounded bg-primary-light text-primary font-semibold">
                      knows {customer.name}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onAssign(resource)}
                className="text-[11px] font-semibold text-white bg-primary border-0 rounded px-2 py-1 cursor-pointer hover:opacity-90 shrink-0"
              >
                Assign
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onClose}
        className="mt-2 w-full text-[11px] font-semibold text-text-mid bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:bg-primary-bg"
      >
        Close
      </button>
    </div>
  );
}
