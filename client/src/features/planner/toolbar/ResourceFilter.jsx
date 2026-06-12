import { useState, useRef, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import Avatar from '../../../components/ui/Avatar';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';

/** Multi-select employee filter — the people counterpart of EntityFilter.
 * When active, the grid shows only needs those people are assigned to. */
export default function ResourceFilter({ selectedIds, onChange }) {
  const { resources } = useData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = search.toLowerCase();
  const filtered = [...resources]
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeCount = selectedIds.size;

  const toggle = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
          activeCount > 0
            ? 'bg-primary-light text-primary border-primary/30'
            : 'bg-transparent text-text-mid border-transparent hover:bg-white'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="9" cy="7" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v6M22 11h-6" />
        </svg>
        People{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 right-0 bg-white rounded-xl border border-border shadow-lg z-[100] w-[240px] max-h-[340px] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-border-light">
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1.5">
            {filtered.map((r) => (
              <label key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary-bg/30 cursor-pointer">
                <input
                  type="checkbox" checked={selectedIds.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="accent-primary w-3.5 h-3.5"
                />
                <Avatar name={r.name} color={domainColor(resourcePrimaryDomain(r))} size={18} />
                <span className="text-xs font-semibold text-text truncate">{r.name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-text-light text-center py-3">No matches</div>
            )}
          </div>
          {activeCount > 0 && (
            <div className="p-2 border-t border-border-light">
              <button
                onClick={() => onChange(new Set())}
                className="w-full text-[11px] text-text-mid bg-transparent border-0 cursor-pointer hover:text-danger py-1"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
