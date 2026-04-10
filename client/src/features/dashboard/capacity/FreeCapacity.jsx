import { useMemo } from 'react';
import { formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { DOMAINS } from '../../../lib/constants';

export default function FreeCapacity({ months }) {
  const { resources } = useData();
  const { rU } = useComputed();

  // Build domain+role groups with their resources
  const groups = useMemo(() => {
    const map = {};
    for (const r of resources) {
      for (const role of (r.roles || [])) {
        const key = `${role.domain}|${role.role}`;
        if (!map[key]) map[key] = { domain: role.domain, role: role.role, resources: [] };
        if (!map[key].resources.some((x) => x.id === r.id)) {
          map[key].resources.push(r);
        }
      }
    }
    // Sort: by domain then role
    return Object.values(map).sort((a, b) => a.domain.localeCompare(b.domain) || a.role.localeCompare(b.role));
  }, [resources]);

  // Compute free capacity per group per month
  const freeData = useMemo(() => {
    const data = {};
    for (const g of groups) {
      const key = `${g.domain}|${g.role}`;
      data[key] = {};
      for (const m of months) {
        let free = 0;
        for (const r of g.resources) {
          const used = rU[r.id]?.[m] || 0;
          free += Math.max(0, r.capacity - used);
        }
        data[key][m] = Math.round(free * 100) / 100;
      }
    }
    return data;
  }, [groups, months, rU]);

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-card p-8 text-center text-sm text-text-light">
        No resources with roles configured
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-auto">
      <h3 className="text-base font-bold text-text px-5 pt-4 pb-2">Free Capacity (FTE)</h3>
      {/* Header */}
      <div className="flex items-center border-b-2 border-border sticky top-0 bg-white z-10">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-semibold text-text-mid">Domain / Role</span>
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 text-center text-[10px] font-mono font-bold text-primary py-2">
            {formatMonth(m)}
          </div>
        ))}
      </div>
      {/* Rows */}
      {groups.map((g) => {
        const key = `${g.domain}|${g.role}`;
        const color = DOMAINS[g.domain]?.color || '#6B8A9E';
        return (
          <div key={key} className="flex items-center border-b border-border-light hover:bg-primary-bg/30">
            <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-text">{g.domain}</span>
              <span className="text-[10px] text-text-light">/</span>
              <span className="text-xs text-text-mid">{g.role}</span>
              <span className="text-[10px] text-text-light ml-auto">({g.resources.length})</span>
            </div>
            {months.map((m) => {
              const free = freeData[key]?.[m] || 0;
              return (
                <FreeCell key={m} value={free} color={color} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function FreeCell({ value, color }) {
  if (value === 0) {
    return (
      <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono text-text-light">
        —
      </div>
    );
  }

  // Green when capacity available, intensity by amount
  const bg = value >= 1 ? '#EAFAF018' : value >= 0.5 ? '#EAFAF010' : 'transparent';
  const textColor = value >= 1 ? '#5BC68A' : value >= 0.5 ? '#F5A623' : '#E8636F';

  return (
    <div className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono font-semibold"
      style={{ color: textColor, backgroundColor: bg }}>
      {value.toFixed(2)}
    </div>
  );
}
