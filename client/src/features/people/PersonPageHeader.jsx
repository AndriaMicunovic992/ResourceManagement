import { useEffect, useMemo, useState } from 'react';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/badges/RoleBadge';
import { useComputed } from '../../hooks/useComputed';
import { api } from '../../lib/api';
import { MONTHS } from '../../lib/constants';
import { currentMonth } from '../../lib/dateUtils';
import { resourcePrimaryDomain, domainColor } from '../../lib/resourceUtils';
import { scoreColor } from '../../lib/statusUtils';
import { Sparkline } from '../../components/ui/LineChart';

function Stat({ value, label, color, spark }) {
  return (
    <div className="text-center">
      <b className="block text-[17px] font-extrabold tracking-tight" style={color ? { color } : undefined}>{value}</b>
      <span className="text-[9.5px] font-semibold text-text-light">{label}</span>
      {spark}
    </div>
  );
}

/** Entity-detail profile card: avatar + chips left, live stats middle, actions right. */
export default function PersonPageHeader({ resource, canEdit, onEdit, viewMode }) {
  const { rU } = useComputed();
  const domain = resourcePrimaryDomain(resource);
  const color = domainColor(domain);
  const m0 = currentMonth();
  const monthShort = MONTHS[parseInt(m0.slice(5), 10) - 1];

  const [evals, setEvals] = useState(null);

  useEffect(() => {
    let dead = false;
    api.listEvaluations({ resourceId: resource.id, state: 'finalized' })
      .then((d) => { if (!dead) setEvals(Array.isArray(d) ? d : []); })
      .catch(() => { if (!dead) setEvals([]); });
    return () => { dead = true; };
  }, [resource.id]);

  const utilization = Math.round(((rU[resource.id]?.[m0] || 0) / (resource.capacity || 1)) * 100);

  const evalSeries = useMemo(() => {
    if (!evals) return [];
    return [...evals]
      .sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd))
      .map((e) => e.overrideFinal ?? e.computedFinal)
      .filter((s) => s != null)
      .slice(-6);
  }, [evals]);
  const lastEval = evalSeries.length ? Math.round(evalSeries[evalSeries.length - 1] * 10) / 10 : null;

  const evalSpark = evalSeries.length >= 2 ? (
    <div className="w-14 mx-auto mt-0.5">
      <Sparkline data={evalSeries} color={scoreColor(lastEval)} height={16} />
    </div>
  ) : null;

  const managers = useMemo(() => {
    // Managers are login users now. Exclude the person's own linked user.
    const direct = (resource.managerLinks || []).map((l) => l.managerUser).filter(Boolean);
    const inherited = (resource.teams || []).map((t) => t.managerUser).filter((m) => m && m.id !== resource.userId);
    const all = [];
    const seen = new Set();
    for (const m of [...direct, ...inherited]) {
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);
      all.push(m);
    }
    return all;
  }, [resource]);

  return (
    <div
      className="flex items-center gap-4 border border-border-light rounded-[18px] p-[18px] mb-4 flex-wrap"
      style={{ background: 'linear-gradient(120deg, #F4FBFD, #fff)' }}
    >
      <Avatar name={resource.name} color={color} size={58} className="shadow-lg" />
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-text m-0 truncate">{resource.name}</h2>
        <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
          {resource.roles?.map((r, i) => <RoleBadge key={i} {...r} />)}
          {(resource.teams || []).map((t) => (
            <span key={t.id} className="text-[9.5px] font-mono font-semibold text-text-mid bg-[#EEF1F5] rounded-[7px] px-2 py-0.5">{t.name}</span>
          ))}
          {managers.length > 0 && (
            <span className="text-[9.5px] font-mono font-semibold text-text-mid bg-[#EEF1F5] rounded-[7px] px-2 py-0.5">
              Mgr · {managers.map((m) => m.name).join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-6 ml-auto items-start">
        <Stat value={resource.capacity} label="capacity" />
        <Stat value={`${utilization}%`} label={`utilized · ${monthShort}`} color={utilization > 100 ? '#E8636F' : undefined} />
        <Stat value={lastEval ?? '—'} label="last eval" color={lastEval != null ? scoreColor(lastEval) : undefined} spark={evalSpark} />
      </div>
      {canEdit && (
        <div className="flex gap-2 lg:ml-4 items-center">
          <button
            onClick={onEdit}
            className="rounded-[11px] font-bold text-[11.5px] px-3.5 py-2.5 cursor-pointer bg-white text-text-mid border border-border-light hover:bg-primary-bg"
          >
            ✎ Edit
          </button>
        </div>
      )}
    </div>
  );
}
