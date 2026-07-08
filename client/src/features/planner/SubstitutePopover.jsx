import { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { resourceMatchesNeed } from '../../lib/resourceUtils';
import { effectiveCapacity, plannedAbsenceDays } from '../../lib/availability';
import { formatMonth } from '../../lib/dateUtils';
import Avatar from '../../components/ui/Avatar';
import { SwapIcon } from '../../components/ui/icons';

/**
 * Hand an assignment's remaining months over to somebody else — the long-leave
 * workflow. From the chosen month onward the original person's months are
 * cleared and (optionally) re-created at the same FTE on a substitute's row on
 * the same need. Candidates are role-matched and ranked by how much effective
 * free capacity (planned absences counted) they have over exactly those
 * months. "No substitute" just clears the months, leaving the need open. The
 * whole handover is one undo entry.
 */
export default function SubstitutePopover({ needId, resourceId, fromMonth, x, y, onUndoable, onError, onClose }) {
  const { needs, projects, customers, resources, assignments, upsertAssignment, deleteAssignment } = useData();
  const [busy, setBusy] = useState(false);

  const need = needs.find((n) => n.id === needId);
  const original = resources.find((r) => r.id === resourceId);
  const assignment = assignments.find((a) => a.needId === needId && a.resourceId === resourceId);
  const own = useMemo(() => assignment?.monthAllocations || {}, [assignment]);

  // Months this person actually holds, as handover-start options.
  const heldMonths = useMemo(
    () => Object.keys(own).filter((m) => own[m] > 0).sort(),
    [own]
  );
  const [from, setFrom] = useState(
    heldMonths.includes(fromMonth) ? fromMonth : heldMonths[0]
  );
  const handMonths = useMemo(() => heldMonths.filter((m) => m >= from), [heldMonths, from]);
  const avgHandFte = handMonths.length
    ? handMonths.reduce((s, m) => s + own[m], 0) / handMonths.length
    : 0;

  const customer = useMemo(() => {
    const project = projects.find((p) => p.id === need?.projectId);
    return customers.find((c) => c.id === project?.customerId) || null;
  }, [projects, customers, need]);

  // Role-matched candidates ranked by free effective capacity over the
  // handover months (their own planned absences already subtracted).
  const candidates = useMemo(() => {
    if (!need || handMonths.length === 0) return [];
    const custProjectIds = customer
      ? new Set(projects.filter((p) => p.customerId === customer.id).map((p) => p.id))
      : new Set();
    const custNeedIds = new Set(needs.filter((n) => custProjectIds.has(n.projectId)).map((n) => n.id));

    return resources
      .filter((r) => r.id !== resourceId && !r.archived && resourceMatchesNeed(r, need))
      .map((r) => {
        const ownAssigns = assignments.filter((a) => a.resourceId === r.id);
        let freeSum = 0;
        let offDays = 0;
        for (const m of handMonths) {
          const used = ownAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
          freeSum += Math.max(0, effectiveCapacity(r, m) - used);
          offDays += plannedAbsenceDays(r, m);
        }
        return {
          resource: r,
          freeAvg: freeSum / handMonths.length,
          offDays,
          alreadyOn: assignments.some(
            (a) => a.needId === needId && a.resourceId === r.id &&
              Object.values(a.monthAllocations || {}).some((v) => v > 0)
          ),
          knowsCustomer: ownAssigns.some((a) => custNeedIds.has(a.needId)),
        };
      })
      .sort(
        (a, b) =>
          b.freeAvg - a.freeAvg ||
          (b.knowsCustomer ? 1 : 0) - (a.knowsCustomer ? 1 : 0)
      )
      .slice(0, 6);
  }, [need, needId, resourceId, resources, assignments, needs, projects, customer, handMonths]);

  if (!need || !original || !assignment || heldMonths.length === 0) return null;

  const rangeLabel =
    handMonths.length === 1
      ? formatMonth(handMonths[0])
      : `${formatMonth(handMonths[0])} – ${formatMonth(handMonths[handMonths.length - 1])}`;

  const handOver = async (sub) => {
    if (busy) return;
    setBusy(true);
    const zero = {};
    const restore = {};
    for (const m of handMonths) {
      zero[m] = 0;
      restore[m] = own[m];
    }
    try {
      if (sub) {
        // Take over at the original person's FTE, on top of anything the
        // substitute already has on this need. Create/extend the substitute
        // FIRST so a failure can't leave the need uncovered.
        const subExisting = assignments.find((a) => a.needId === needId && a.resourceId === sub.id);
        const subPrev = subExisting?.monthAllocations || {};
        const subDelta = {};
        const subRestore = {};
        for (const m of handMonths) {
          subDelta[m] = Math.round(((subPrev[m] || 0) + own[m]) * 100) / 100;
          subRestore[m] = subPrev[m] || 0;
        }
        const created = await upsertAssignment({ needId, resourceId: sub.id, monthAllocations: subDelta });
        await upsertAssignment({ needId, resourceId, monthAllocations: zero });
        onUndoable?.(`${original.name} → ${sub.name} from ${formatMonth(from)}`, async () => {
          await upsertAssignment({ needId, resourceId, monthAllocations: restore });
          if (subExisting) {
            await upsertAssignment({ needId, resourceId: sub.id, monthAllocations: subRestore });
          } else if (created?.id) {
            await deleteAssignment(created.id);
          }
        });
      } else {
        await upsertAssignment({ needId, resourceId, monthAllocations: zero });
        onUndoable?.(`Cleared ${original.name} from ${formatMonth(from)}`, () =>
          upsertAssignment({ needId, resourceId, monthAllocations: restore })
        );
      }
      onClose();
    } catch (e) {
      onError?.(e);
      onClose();
    }
  };

  return (
    <div
      className="fixed bg-white rounded-2xl border border-[#F1F5F9] p-3.5 z-[3000] w-[300px]"
      style={{
        left: Math.min(x, window.innerWidth - 320),
        top: Math.min(y, window.innerHeight - 360),
        boxShadow: '0 16px 40px rgba(44,62,80,0.18)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-light flex items-center gap-1">
            <SwapIcon size={10} /> Substitute
          </div>
          <div className="text-xs font-bold text-text">{original.name} · {need.role}</div>
        </div>
        <button onClick={onClose}
          className="px-1.5 py-0.5 text-text-mid text-xs cursor-pointer border-0 bg-transparent hover:text-danger">
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold text-text-mid">Hand over from</span>
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="text-[11px] font-mono font-semibold text-text border border-border rounded-lg px-1.5 py-0.5 bg-white outline-none focus:border-primary cursor-pointer"
        >
          {heldMonths.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
      </div>
      <div className="text-[9.5px] text-text-light mb-2">
        {rangeLabel} · {handMonths.length} month{handMonths.length === 1 ? '' : 's'} · avg {avgHandFte.toFixed(2)} FTE
      </div>

      {candidates.length === 0 ? (
        <div className="text-xs text-text-mid py-1.5">No other matching people for this role.</div>
      ) : (
        <div className="space-y-1.5 max-h-[210px] overflow-y-auto -mx-1 px-1">
          {candidates.map(({ resource, freeAvg, offDays, alreadyOn, knowsCustomer }) => {
            const tight = freeAvg + 0.001 < avgHandFte;
            return (
              <div key={resource.id} className="flex items-center gap-2">
                <Avatar name={resource.name} color="#4CBAD4" size={24} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text truncate">{resource.name}</div>
                  <div className="text-[10px] text-text-mid">
                    <span className={tight ? 'text-warning font-semibold' : ''}>+{freeAvg.toFixed(1)} free</span>
                    {offDays > 0 && <span className="text-slate-400"> · {offDays}d off</span>}
                    {alreadyOn && <span> · already on this need</span>}
                    {knowsCustomer && customer && (
                      <span className="ml-1 px-1 rounded bg-primary-light text-primary font-semibold">
                        knows {customer.name}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handOver(resource)}
                  disabled={busy}
                  title={tight ? 'Less free capacity than the handover needs — they will show as overbooked' : undefined}
                  className="text-[11px] font-semibold text-white bg-primary border-0 rounded px-2 py-1 cursor-pointer hover:opacity-90 shrink-0 disabled:opacity-50"
                >
                  Hand over
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => handOver(null)}
        disabled={busy}
        className="mt-2 w-full text-[11px] font-semibold text-text-mid bg-transparent border border-border rounded-lg px-2 py-1.5 cursor-pointer hover:bg-danger-bg hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50"
        title="Clear these months without assigning anyone — the need shows as open"
      >
        No substitute — leave the months open
      </button>
    </div>
  );
}
