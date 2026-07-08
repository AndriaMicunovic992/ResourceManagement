import { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { resourceMatchesNeed } from '../../lib/resourceUtils';
import { effectiveCapacity, plannedAbsenceDays } from '../../lib/availability';
import { formatMonth } from '../../lib/dateUtils';
import { fteToHours, hoursToFte } from '../../lib/constants';
import Avatar from '../../components/ui/Avatar';
import { SwapIcon } from '../../components/ui/icons';

/**
 * Hand part of an assignment over to somebody else. Two scopes: just the
 * clicked month (default — a short leave or a one-month rebalance), or all
 * remaining months from it (the long-leave workflow). The amount is editable
 * in FTE or hours and defaults to the person's full allocation; a smaller
 * amount splits the month between the two people (the original keeps the
 * rest). Per month the handover is capped at what the person actually holds.
 * Candidates are role-matched and ranked by free effective capacity (planned
 * absences counted) over exactly the handed months. "No substitute" removes
 * the amount without re-assigning it, reopening the need. The whole handover
 * is one undo entry.
 */
export default function SubstitutePopover({ needId, resourceId, fromMonth, x, y, onUndoable, onError, onClose }) {
  const { needs, projects, customers, resources, assignments, upsertAssignment, deleteAssignment } = useData();
  const [busy, setBusy] = useState(false);

  const need = needs.find((n) => n.id === needId);
  const original = resources.find((r) => r.id === resourceId);
  const assignment = assignments.find((a) => a.needId === needId && a.resourceId === resourceId);
  const own = useMemo(() => assignment?.monthAllocations || {}, [assignment]);

  // Months this person actually holds — the scope options.
  const heldMonths = useMemo(
    () => Object.keys(own).filter((m) => own[m] > 0).sort(),
    [own]
  );
  const initialFrom = heldMonths.includes(fromMonth) ? fromMonth : heldMonths[0];
  const [from, setFrom] = useState(initialFrom);
  // 'month' = only the selected month; 'toEnd' = it and everything after.
  const [scope, setScope] = useState('month');
  // Amount handed over per month, editable as FTE or hours. Defaults to the
  // selected month's full allocation; capped per month at what they hold.
  const [amount, setAmount] = useState(() => (own[initialFrom] > 0 ? String(own[initialFrom]) : ''));
  const [amountHours, setAmountHours] = useState(() =>
    own[initialFrom] > 0 ? String(fteToHours(own[initialFrom])) : ''
  );

  const setAmountBoth = (fte) => {
    setAmount(String(fte));
    setAmountHours(String(fteToHours(fte)));
  };
  const handleFromChange = (m) => {
    setFrom(m);
    if (own[m] > 0) setAmountBoth(own[m]); // reset to "their full month" for the new month
  };
  const handleAmountChange = (v) => {
    setAmount(v);
    const n = parseFloat(v);
    if (Number.isFinite(n)) setAmountHours(String(fteToHours(n)));
  };
  const handleHoursChange = (v) => {
    setAmountHours(v);
    const n = parseFloat(v);
    if (Number.isFinite(n)) setAmount(String(hoursToFte(n)));
  };

  const parsedAmount = parseFloat(amount);
  const amtFte = Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0;

  const handMonths = useMemo(
    () => (scope === 'month' ? (heldMonths.includes(from) ? [from] : []) : heldMonths.filter((m) => m >= from)),
    [scope, from, heldMonths]
  );
  const handedFor = (m) => Math.round(Math.min(amtFte, own[m] || 0) * 100) / 100;
  // Months where something actually moves (amount 0 → nothing to hand over).
  const activeMonths = handMonths.filter((m) => handedFor(m) > 0.004);
  const partial = activeMonths.some((m) => handedFor(m) < (own[m] || 0) - 0.004);
  const avgHandFte = activeMonths.length
    ? activeMonths.reduce((s, m) => s + handedFor(m), 0) / activeMonths.length
    : 0;

  const customer = useMemo(() => {
    const project = projects.find((p) => p.id === need?.projectId);
    return customers.find((c) => c.id === project?.customerId) || null;
  }, [projects, customers, need]);

  // Role-matched candidates ranked by free effective capacity over the
  // handed months (their own planned absences already subtracted).
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

  const fmt = (v) => (Math.round(v * 100) / 100).toFixed(2);
  const monthWord = scope === 'month' ? formatMonth(from) : null;
  const rangeLabel =
    activeMonths.length === 0
      ? '—'
      : scope === 'month'
        ? `${formatMonth(from)} · hands over ${fmt(handedFor(from))} of ${fmt(own[from] || 0)} FTE`
        : `${formatMonth(activeMonths[0])} – ${formatMonth(activeMonths[activeMonths.length - 1])} · ${activeMonths.length} month${activeMonths.length === 1 ? '' : 's'} · ${partial ? `up to ${fmt(amtFte)} FTE each` : `avg ${fmt(avgHandFte)} FTE`}`;

  const handOver = async (sub) => {
    if (busy || activeMonths.length === 0) return;
    setBusy(true);
    // The original keeps whatever the amount doesn't take.
    const origDelta = {};
    const restore = {};
    for (const m of activeMonths) {
      origDelta[m] = Math.max(0, Math.round(((own[m] || 0) - handedFor(m)) * 100) / 100);
      restore[m] = own[m];
    }
    const when = scope === 'month' ? `for ${formatMonth(from)}` : `from ${formatMonth(from)}`;
    try {
      if (sub) {
        // Take over on top of anything the substitute already has on this
        // need. Create/extend the substitute FIRST so a failure can't leave
        // the need uncovered.
        const subExisting = assignments.find((a) => a.needId === needId && a.resourceId === sub.id);
        const subPrev = subExisting?.monthAllocations || {};
        const subDelta = {};
        const subRestore = {};
        for (const m of activeMonths) {
          subDelta[m] = Math.round(((subPrev[m] || 0) + handedFor(m)) * 100) / 100;
          subRestore[m] = subPrev[m] || 0;
        }
        const created = await upsertAssignment({ needId, resourceId: sub.id, monthAllocations: subDelta });
        await upsertAssignment({ needId, resourceId, monthAllocations: origDelta });
        onUndoable?.(`${original.name} → ${sub.name} ${when}`, async () => {
          await upsertAssignment({ needId, resourceId, monthAllocations: restore });
          if (subExisting) {
            await upsertAssignment({ needId, resourceId: sub.id, monthAllocations: subRestore });
          } else if (created?.id) {
            await deleteAssignment(created.id);
          }
        });
      } else {
        await upsertAssignment({ needId, resourceId, monthAllocations: origDelta });
        onUndoable?.(`${partial ? 'Reduced' : 'Cleared'} ${original.name} ${when}`, () =>
          upsertAssignment({ needId, resourceId, monthAllocations: restore })
        );
      }
      onClose();
    } catch (e) {
      onError?.(e);
      onClose();
    }
  };

  const scopeBtn = (active) =>
    `flex-1 px-2 py-1 text-[10px] font-semibold cursor-pointer border-0 transition-colors ${
      active ? 'bg-primary text-white' : 'bg-white text-text-mid hover:bg-primary-bg'
    }`;

  return (
    <div
      className="fixed bg-white rounded-2xl border border-[#F1F5F9] p-3.5 z-[3000] w-[310px]"
      style={{
        left: Math.min(x, window.innerWidth - 330),
        top: Math.min(y, window.innerHeight - 420),
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
        <span className="text-[10px] font-semibold text-text-mid">Month</span>
        <select
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          className="text-[11px] font-mono font-semibold text-text border border-border rounded-lg px-1.5 py-0.5 bg-white outline-none focus:border-primary cursor-pointer"
        >
          {heldMonths.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden mb-2">
        <button onClick={() => setScope('month')} className={scopeBtn(scope === 'month')}>
          Only {formatMonth(from)}
        </button>
        <button onClick={() => setScope('toEnd')} className={scopeBtn(scope === 'toEnd')}
          title="This month and every held month after it">
          {formatMonth(from)} → end
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-semibold text-text-mid shrink-0">Hand over</span>
        <input
          type="number" step="0.05" min="0" max={own[from] || 1}
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          className="w-14 px-1.5 py-0.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
        />
        <span className="text-[9px] text-text-light">FTE</span>
        <input
          type="number" step="1" min="0"
          value={amountHours}
          onChange={(e) => handleHoursChange(e.target.value)}
          className="w-14 px-1.5 py-0.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
        />
        <span className="text-[9px] text-text-light">h/mo</span>
        {partial && (
          <span className="ml-auto text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary-light text-primary shrink-0">
            split
          </span>
        )}
      </div>
      <div className="text-[9.5px] text-text-light mb-2">
        {activeMonths.length === 0
          ? 'Nothing to hand over — set an amount above 0.'
          : <>{rangeLabel}{partial && scope === 'month' ? ` · ${original.name.split(' ')[0]} keeps ${fmt((own[from] || 0) - handedFor(from))}` : ''}</>}
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
                  disabled={busy || activeMonths.length === 0}
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
        disabled={busy || activeMonths.length === 0}
        className="mt-2 w-full text-[11px] font-semibold text-text-mid bg-transparent border border-border rounded-lg px-2 py-1.5 cursor-pointer hover:bg-danger-bg hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50"
        title="Remove this amount without assigning anyone — the need shows as open"
      >
        {partial
          ? `No substitute — just reduce ${monthWord || 'the months'}`
          : `No substitute — leave ${monthWord || 'the months'} open`}
      </button>
    </div>
  );
}
