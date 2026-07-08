import { useMemo, useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { monthRange, formatMonth, currentMonth } from '../../../lib/dateUtils';
import {
  plannedAbsenceDays,
  effectiveCapacity,
  WORKDAYS_PER_MONTH,
  HOURS_PER_WORKDAY,
} from '../../../lib/availability';

/**
 * Planned days off per month for one person, entered right in the planner
 * pool. Values are workdays (halves allowed); saving sends only the months
 * that changed, so concurrent edits to other months are never clobbered.
 * Elapsed months stay editable but synced Tempo absences remain the truth
 * for what actually happened — this map is the forward plan.
 */
export default function AbsencePopover({ resource, timeRange, x, y, onClose, onError }) {
  const { setResourceAbsences } = useData();
  const cur = currentMonth();
  const months = useMemo(() => monthRange(timeRange.start, timeRange.end), [timeRange]);
  const stored = (m) => plannedAbsenceDays(resource, m);
  const [values, setValues] = useState(() =>
    Object.fromEntries(months.map((m) => [m, stored(m) > 0 ? String(stored(m)) : '']))
  );
  const [saving, setSaving] = useState(false);

  const parsed = (m) => {
    const n = parseFloat(values[m]);
    return Number.isFinite(n) && n > 0 ? Math.min(31, Math.max(0, n)) : 0;
  };

  const save = async () => {
    const delta = {};
    for (const m of months) {
      if (Math.abs(parsed(m) - stored(m)) > 0.01) delta[m] = parsed(m);
    }
    if (Object.keys(delta).length === 0) return onClose();
    setSaving(true);
    try {
      await setResourceAbsences(resource.id, delta);
      onClose();
    } catch (e) {
      setSaving(false);
      onError?.(e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') onClose();
  };

  // A "whole month" of leave in workday terms (≈21.7 → 22 fully zeroes the month).
  const fullMonth = Math.ceil(WORKDAYS_PER_MONTH);

  return (
    <div
      className="fixed bg-white rounded-2xl border border-[#F1F5F9] p-3.5 z-[3000] w-[280px]"
      style={{
        left: Math.min(x, window.innerWidth - 300),
        top: Math.min(y, window.innerHeight - 340),
        boxShadow: '0 16px 40px rgba(44,62,80,0.18)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-light">Days off</div>
          <div className="text-xs font-bold text-text">{resource.name}</div>
        </div>
        <button onClick={onClose}
          className="px-1.5 py-0.5 text-text-mid text-xs cursor-pointer border-0 bg-transparent hover:text-danger">
          ✕
        </button>
      </div>
      <div className="text-[9.5px] text-text-light mb-2">
        Workdays per month · 1 day = {HOURS_PER_WORKDAY}h · full month ≈ {WORKDAYS_PER_MONTH.toFixed(0)}d
      </div>
      <div className="max-h-[240px] overflow-y-auto -mx-1 px-1">
        {months.map((m) => {
          const days = parsed(m);
          const eff = effectiveCapacity({ ...resource, plannedAbsences: { [m]: days } }, m);
          return (
            <div key={m} className="flex items-center gap-2 py-1 border-b border-border-light/60 last:border-0">
              <span className={`w-14 shrink-0 text-[10px] font-mono font-bold ${m === cur ? 'text-primary' : 'text-text-mid'}`}>
                {formatMonth(m)}
              </span>
              <input
                type="number" step="0.5" min="0" max="31"
                value={values[m]}
                placeholder="0"
                onChange={(e) => setValues((v) => ({ ...v, [m]: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="w-14 px-1.5 py-0.5 border border-border rounded-lg text-xs font-mono text-text outline-none focus:border-primary"
              />
              <span className="text-[9px] text-text-light">d</span>
              <button
                onClick={() => setValues((v) => ({ ...v, [m]: days >= fullMonth ? '' : String(fullMonth) }))}
                className={`text-[9px] font-semibold border rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
                  days >= fullMonth
                    ? 'bg-slate-400 text-white border-slate-400'
                    : 'bg-white text-text-mid border-border hover:border-slate-400 hover:text-slate-500'
                }`}
                title="Toggle the whole month off"
              >
                all
              </button>
              <span className="ml-auto text-[9px] font-mono text-text-light shrink-0">
                {days > 0 ? `→ ${eff.toFixed(2)} FTE` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <button onClick={save} disabled={saving}
          className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:opacity-90 active:scale-95 transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onClose}
          className="px-2 py-1 text-text-mid text-xs cursor-pointer border-0 bg-transparent hover:text-text">
          Cancel
        </button>
      </div>
    </div>
  );
}
