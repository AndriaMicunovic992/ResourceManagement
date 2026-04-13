import { useState, useMemo } from 'react';
import { formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';
import { useComputed } from '../../../hooks/useComputed';
import { DOMAINS, SENIORITY_SHORT } from '../../../lib/constants';

export default function FreeCapacity({ months, includePotential, teamId }) {
  const { resources: allResources, needs, projects, customers } = useData();
  const { rURealised } = useComputed();
  const [expanded, setExpanded] = useState({});
  const [expandedRoles, setExpandedRoles] = useState({});

  const resources = useMemo(
    () => (teamId ? allResources.filter((r) => r.teamId === teamId) : allResources),
    [allResources, teamId]
  );

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

  // Potential need demand per domain/role/seniority per month
  const potentialDemand = useMemo(() => {
    if (!includePotential) return {};
    const demand = {};
    for (const n of needs) {
      const proj = projects.find((p) => p.id === n.projectId);
      if (!proj) continue;
      const cust = customers.find((c) => c.id === proj.customerId);
      if (!cust) continue;
      const isPotential = n.status === 'potential' || proj.status === 'potential' || cust.status === 'potential';
      if (!isPotential) continue;
      const allocs = n.monthAllocations || {};
      const dk = n.domain;
      const rk = n.role;
      const sk = n.seniority;
      for (const [m, fte] of Object.entries(allocs)) {
        if (fte <= 0) continue;
        // domain level
        const dKey = dk;
        if (!demand[dKey]) demand[dKey] = {};
        demand[dKey][m] = (demand[dKey][m] || 0) + fte;
        // role level
        const rKey = `${dk}|${rk}`;
        if (!demand[rKey]) demand[rKey] = {};
        demand[rKey][m] = (demand[rKey][m] || 0) + fte;
        // seniority level
        const sKey = `${dk}|${rk}|${sk}`;
        if (!demand[sKey]) demand[sKey] = {};
        demand[sKey][m] = (demand[sKey][m] || 0) + fte;
      }
    }
    return demand;
  }, [needs, projects, customers, includePotential]);

  // Compute free FTE for a set of resource IDs per month (realised usage only)
  const computeFree = (resourceIds, month) => {
    let free = 0;
    const seen = new Set();
    for (const id of resourceIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const r = resources.find((x) => x.id === id);
      if (!r) continue;
      const used = rURealised[r.id]?.[month] || 0;
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

  // Total free capacity per month (all resources, deduplicated)
  const allResourceIds = useMemo(() => [...new Set(resources.map((r) => r.id))], [resources]);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-auto">
      <h3 className="text-base font-bold text-text px-5 pt-4 pb-2">Free Capacity (FTE)</h3>
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
      {tree.map((d) => {
        const color = DOMAINS[d.domain]?.color || '#6B8A9E';
        const domainExpanded = !!expanded[d.domain];
        const dKey = d.domain;
        return (
          <div key={d.domain}>
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
              {months.map((m) => {
                const free = computeFree(d.resources, m);
                const pDemand = potentialDemand[dKey]?.[m] || 0;
                return <FreeCell key={m} value={includePotential ? Math.max(0, free - pDemand) : free} hasPotential={pDemand > 0 && includePotential} />;
              })}
            </div>
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
                    {months.map((m) => {
                      const free = computeFree(r.resources, m);
                      const pDemand = potentialDemand[roleKey]?.[m] || 0;
                      return <FreeCell key={m} value={includePotential ? Math.max(0, free - pDemand) : free} hasPotential={pDemand > 0 && includePotential} />;
                    })}
                  </div>
                  {roleExpanded && r.seniorities.map((s) => {
                    const senKey = `${d.domain}|${r.role}|${s.seniority}`;
                    return (
                      <div key={s.seniority} className="flex items-center border-b border-border-light/50 hover:bg-primary-bg/20">
                        <div className="w-[270px] shrink-0 px-3 py-1 flex items-center gap-2 pl-14">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-bg text-text-mid font-mono">
                            {SENIORITY_SHORT[s.seniority] || s.seniority}
                          </span>
                          <span className="text-[10px] text-text-light">{s.seniority}</span>
                          <span className="text-[10px] text-text-light ml-auto">({s.resources.length})</span>
                        </div>
                        {months.map((m) => {
                          const free = computeFree(s.resources, m);
                          const pDemand = potentialDemand[senKey]?.[m] || 0;
                          return <FreeCell key={m} value={includePotential ? Math.max(0, free - pDemand) : free} hasPotential={pDemand > 0 && includePotential} small />;
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
      {/* Totals row */}
      <div className="flex items-center border-t-2 border-border bg-primary-bg/30 sticky bottom-0">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-bold text-text">Total Free</span>
        </div>
        {months.map((m) => {
          const free = computeFree(allResourceIds, m);
          const totalPDemand = Object.values(potentialDemand).reduce((s, dm) => s + (dm[m] || 0), 0);
          const val = includePotential ? Math.max(0, free - totalPDemand) : free;
          return (
            <div key={m} className="w-[82px] shrink-0 flex items-center justify-center text-[11px] font-mono font-bold text-primary">
              {val > 0 ? val.toFixed(1) : '—'}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FreeCell({ value, small, hasPotential }) {
  if (value === 0 && !hasPotential) {
    return (
      <div className={`w-[82px] shrink-0 flex items-center justify-center font-mono text-text-light ${small ? 'text-[10px]' : 'text-[11px]'}`}>
        —
      </div>
    );
  }

  if (hasPotential) {
    return (
      <div className={`w-[82px] shrink-0 flex items-center justify-center font-mono font-semibold ${small ? 'text-[10px]' : 'text-[11px]'}`}
        style={{ color: '#9CA3AF', backgroundColor: '#F3F4F6' }}>
        {value.toFixed(2)}
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
