import { useState, useRef, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';

export default function EntityFilter({ selectedIds, onChange }) {
  const { customers, projects } = useData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = search.toLowerCase();
  const filtered = customers.map((c) => ({
    ...c,
    projects: projects.filter((p) => p.customerId === c.id && (!q || p.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))),
    matches: !q || c.name.toLowerCase().includes(q),
  })).filter((c) => c.matches || c.projects.length > 0);

  const activeCount = selectedIds.size;

  const toggleCustomer = (cId) => {
    const next = new Set(selectedIds);
    const custProjectIds = projects.filter((p) => p.customerId === cId).map((p) => p.id);
    if (next.has('c:' + cId)) {
      next.delete('c:' + cId);
      custProjectIds.forEach((pId) => next.delete('p:' + pId));
    } else {
      next.add('c:' + cId);
      custProjectIds.forEach((pId) => next.add('p:' + pId));
    }
    onChange(next);
  };

  const toggleProject = (pId, cId) => {
    const next = new Set(selectedIds);
    if (next.has('p:' + pId)) {
      next.delete('p:' + pId);
      // If no projects selected for this customer, remove customer too
      const custProjectIds = projects.filter((p) => p.customerId === cId).map((p) => p.id);
      if (!custProjectIds.some((id) => next.has('p:' + id))) next.delete('c:' + cId);
    } else {
      next.add('p:' + pId);
      next.add('c:' + cId);
    }
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

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
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M9 7h.01M15 7h.01M9 12h.01M15 12h.01" />
        </svg>
        Customers{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-white rounded-xl border border-border shadow-lg z-[100] w-[260px] max-h-[340px] flex flex-col"
          onClick={(e) => e.stopPropagation()}>
          <div className="p-2 border-b border-border-light">
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1.5 border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1.5">
            {filtered.map((c) => (
              <div key={c.id}>
                <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary-bg/30 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.has('c:' + c.id)}
                    onChange={() => toggleCustomer(c.id)}
                    className="accent-primary w-3.5 h-3.5" />
                  <span className="text-xs font-semibold text-text truncate">{c.name}</span>
                </label>
                {c.projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1 pl-7 rounded-lg hover:bg-primary-bg/30 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.has('p:' + p.id)}
                      onChange={() => toggleProject(p.id, c.id)}
                      className="accent-primary w-3 h-3" />
                    <span className="text-[11px] text-text-mid truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-text-light text-center py-3">No matches</div>
            )}
          </div>
          {activeCount > 0 && (
            <div className="p-2 border-t border-border-light">
              <button onClick={clearAll}
                className="w-full text-[11px] text-text-mid bg-transparent border-0 cursor-pointer hover:text-danger py-1">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
