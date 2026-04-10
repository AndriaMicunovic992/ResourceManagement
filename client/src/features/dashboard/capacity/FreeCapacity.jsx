import { useState, useMemo } from 'react';
import { formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { DOMAINS, SENIORITY_SHORT } from '../../../lib/constants';

export default function FreeCapacity({ months, includePotential }) {
  const { resources } = useData();
  const { rU, rURealised } = useComputed();
  const [expanded, setExpanded] = useState({});     // domain → true
  const [expandedRoles, setExpandedRoles] = useState({}); // "domain|role" → true

  const toggleDomain = (d) => setExpanded((s) => ({ ...s, [d]: !s[d] }));
  const toggleRole = (key) => setExpandedRoles((s) => ({ ...s, [key]: !s[key] }));

  // Build hierarchy: domain → role → seniority, each with resource lists
  const tree = useMemo(() => {
    const domains = {};
    for (const r of resources) {
      for (const rl of (r.roles || [])) {
        const dk = rl.domain;
        const rk = rl.role;
        const sk = rl.seniority;
        if (!domains[dk]) domains[dk] = { domain: dk, roles: {}, resources: new Set() };
        if (!domains[dk].roles[rk]) domains[dk].roles[rk] = { role: rk, seniorities: {}, resources: new Set() };
        if (!domains[dk].roles[rk].seniorities[sk]) domains[dk].roles[rk].seniorities[sk] = { seniority: sk, resources: new Set() };
        domains[dk].resources.add(r.id);
        domains[dk].roles[rk].resources.add(r.id);
        domains[dk].roles[rk].seniorities[sk].resources.add(r.id);
      }
    }
    return Object.values(domains)
      .sort((a, b) => a.domain.localeCompare(b.domain))
      .map((d) => ({
        ...d,
        resources: [...d.resources],
        roles: Object.values(d.roles)
          .sort((a, b) => a.role.localeCompare(b.role))
          .map((r) => ({
            ...r,
            resources: [...r.resources],
            seniorities: Object.values(r.seniorities)
              .sort((a, b) => a.seniority.localeCompare(b.seniority))
              .map((s) => ({ ...s, resources: [...s.resources] })),
          })),
      }));
  }, [resources]);

  // Compute free FTE for a set of resource IDs per month
  const computeFree = (resourceIds, month) => {
    const rUsed = includePotential ? rU : rURealised;
    let free = 0;
    const seen = new Set();
    for (const id of resourceIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const r = resources.find((x) => x.id === id);
      if (!r) continue;
      const used = rUsed[r.id]?.[month] || 0;
      free += Math.max(0, r.capacity - used);
    }
    return Math.round(free * 100) / 100;
  };

  if (tree.length === 0) {
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
          <span className="text-xs font-semibold text-text-mid">Domain / Role / Seniority</span>
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 text-center text-[10px] font-mono font-bold text-primary py-2">
            {formatMonth(m)}
          </div>
        ))}
      </div>
      {/* Rows */}
      {tree.map((d) => {
        const color = DOMAINS[d.domain]?.color || '#6B8A9E';
        const domainExpanded = !!expanded[d.domain];
        return (
          <div key={d.domain}>
            {/* Domain row */}
            <div
              className="flex items-center border-b border-border cursor-pointer hover:bg-primary-bg/30"
              style={{ background: color + '08' }}
              onClick={() => toggleDomain(d.domain)}
            >
              <div className="w-[270px] shrink-0 px-3 py-2 flex items-center gap-2">
                <span className="text-[10px] text-text-mid transition-transform" style={{ transform: domainExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-bold text-text">{d.domain}</span>
                <span className="text-[10px] text-text-light ml-auto">({d.resources.length})</span>
              </div>
              {months.map((m) => (
                <FreeCell key={m} value={computeFree(d.resources, m)} />
              ))}
            </div>
            {/* Role rows */}
            {domainExpanded && d.roles.map((r) => {
              const roleKey = `${d.domain}|${r.role}`;
              const roleExpanded = !!expandedRoles[roleKey];
              return (
                <div key={roleKey}>
                  <div
                    className="flex items-center border-b border-border-light cursor-pointer hover:bg-primary-bg/30"
                    onClick={() => toggleRole(roleKey)}
                  >
                    <div className="w-[270px] shrink-0 px-3 py-1.5 flex items-center gap-2 pl-8">
                      <span className="text-[10px] text-text-mid transition-transform" style={{ transform: roleExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                      <span className="text-xs font-semibold text-text-mid">{r.role}</span>
                      <span className="text-[10px] text-text-light ml-auto">({r.resources.length})</span>
                    </div>
                    {months.map((m) => (
                      <FreeCell key={m} value={computeFree(r.resources, m)} />
                    ))}
                  </div>
                  {/* Seniority rows */}
                  {roleExpanded && r.seniorities.map((s) => (
                    <div key={s.seniority} className="flex items-center border-b border-border-light/50 hover:bg-primary-bg/20">
                      <div className="w-[270px] shrink-0 px-3 py-1 flex items-center gap-2 pl-14">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-bg text-text-mid font-mono">
                          {SENIORITY_SHORT[s.seniority] || s.seniority}
                        </span>
                        <span className="text-[10px] text-text-light">{s.seniority}</span>
                        <span className="text-[10px] text-text-light ml-auto">({s.resources.length})</span>
                      </div>
                      {months.map((m) => (
                        <FreeCell key={m} value={computeFree(s.resources, m)} small />
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function FreeCell({ value, small }) {
  if (value === 0) {
    return (
      <div className={`w-[82px] shrink-0 flex items-center justify-center font-mono text-text-light ${small ? 'text-[10px]' : 'text-[11px]'}`}>
        —
      </div>
    );
  }

  const textColor = value >= 1 ? '#5BC68A' : value >= 0.5 ? '#F5A623' : '#E8636F';

  return (
    <div className={`w-[82px] shrink-0 flex items-center justify-center font-mono font-semibold ${small ? 'text-[10px]' : 'text-[11px]'}`}
      style={{ color: textColor }}>
      {value.toFixed(2)}
    </div>
  );
}
