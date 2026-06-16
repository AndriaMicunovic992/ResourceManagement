import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import ResourceForm from '../../components/forms/ResourceForm';
import { useData } from '../../contexts/DataContext';
import { useOrg } from '../../contexts/OrgContext';
import { useComputed } from '../../hooks/useComputed';
import { api } from '../../lib/api';
import { MONTHS } from '../../lib/constants';
import { seniorityShort } from '../../lib/taxonomy';
import { currentMonth } from '../../lib/dateUtils';
import { resourcePrimaryDomain, domainColor } from '../../lib/resourceUtils';
import RemindersPanel from './RemindersPanel';

// List-row load colors (mockup language): red over capacity, green healthy,
// slate for light load — under-allocation isn't alarming in a people list.
function loadColor(pct) {
  if (pct > 100) return '#E8636F';
  if (pct >= 70) return '#5BC68A';
  if (pct > 0) return '#94A3B8';
  return '#D8E8EF';
}

export default function PeopleListView() {
  const { resources, teams, addResource } = useData();
  const { canEdit } = useOrg();
  const { rU } = useComputed();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [teamId, setTeamId] = useState('');
  const [adding, setAdding] = useState(false);
  const [overdueIds, setOverdueIds] = useState(() => new Set());

  const m0 = currentMonth();
  const monthShort = MONTHS[parseInt(m0.slice(5), 10) - 1];

  // Overdue 1:1s for people I manage — powers the "needs you" row treatment.
  useEffect(() => {
    let dead = false;
    api.getMyReminders()
      .then((items) => {
        if (dead || !Array.isArray(items)) return;
        setOverdueIds(new Set(items.filter((i) => i.type === 'oneOnOne').map((i) => i.resourceId)));
      })
      .catch(() => {});
    return () => { dead = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources
      .filter((r) => !teamId || (r.teams || []).some((t) => t.id === teamId))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, search, teamId]);

  const pctFor = (r) => Math.round(((rU[r.id]?.[m0] || 0) / (r.capacity || 1)) * 100);
  const overCount = resources.filter((r) => pctFor(r) > 100).length;

  const handleCreate = async (data) => {
    const created = await addResource(data);
    setAdding(false);
    if (created?.id) navigate(`/people/${created.id}`);
  };

  const segTeams = teams.length > 0 && teams.length <= 4;

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <RemindersPanel />
      <PageHeader
        title="People"
        subtitle={`${resources.length} ${resources.length === 1 ? 'person' : 'people'} · ${
          overCount > 0 ? `${overCount} over capacity in ${monthShort}` : `all within capacity in ${monthShort}`
        }`}
      >
        <div className="flex items-center gap-2 border border-border-light bg-white rounded-xl px-3 py-2 min-w-[200px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-light shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className="text-[11.5px] font-medium text-text outline-none bg-transparent w-full placeholder:text-text-light"
          />
        </div>
        {segTeams ? (
          <span className="flex bg-[#EEF1F5] rounded-[11px] p-[3px]">
            {[{ id: '', name: 'All' }, ...teams].map((t) => (
              <button
                key={t.id}
                onClick={() => setTeamId(t.id)}
                className={`text-[10.5px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  teamId === t.id ? 'bg-white text-primary shadow-[0_1px_4px_rgba(34,49,63,0.12)]' : 'text-text-mid hover:text-text'
                }`}
              >
                {t.name}
              </button>
            ))}
          </span>
        ) : teams.length > 0 ? (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="px-3 py-2 rounded-xl text-[11px] font-semibold border border-border-light bg-white text-text-mid outline-none focus:border-primary cursor-pointer"
          >
            <option value="">All teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : null}
        {canEdit && <Button onClick={() => setAdding(true)}>＋ Person</Button>}
      </PageHeader>

      {filtered.length === 0 ? (
        <div className="text-center text-text-light text-sm py-10 bg-white rounded-2xl border border-border-light">
          No people match the current filters.
        </div>
      ) : (
        <div className="bg-white border border-border-light rounded-2xl shadow-card p-2">
          {filtered.map((r) => {
            const color = domainColor(resourcePrimaryDomain(r));
            const pct = pctFor(r);
            const overdue = overdueIds.has(r.id);
            const hot = overdue || pct > 100;
            return (
              <Link
                key={r.id}
                to={`/people/${r.id}`}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl no-underline mb-1 last:mb-0 transition ${
                  hot ? 'border border-border-light shadow-[0_8px_22px_rgba(34,49,63,0.10)]' : 'hover:bg-[#F7FAFC]'
                }`}
              >
                <Avatar name={r.name} color={color} size={34} />
                <span className="w-[220px] min-w-0 shrink-0">
                  <span className="block text-[12.5px] font-bold text-text truncate">{r.name}</span>
                  <span className="block text-[9.5px] font-mono text-text-light truncate mt-0.5">
                    {(r.roles || []).map((role) => `${role.domain.slice(0, 3)} ${role.role}·${seniorityShort(role.seniority)}`).join(' · ') || '—'}
                  </span>
                </span>
                {(r.teams || []).slice(0, 2).map((t) => (
                  <span key={t.id} className="text-[9.5px] font-semibold text-text-mid bg-[#EEF1F5] rounded-full px-2.5 py-1 shrink-0">{t.name}</span>
                ))}
                <span className="ml-auto w-[120px] shrink-0">
                  <span className="flex justify-between text-[9px] font-mono text-text-light mb-1">
                    <span>{monthShort}</span>
                    <span style={pct > 100 ? { color: '#E8636F', fontWeight: 700 } : undefined}>{pct}%</span>
                  </span>
                  <span className="block h-[5px] rounded bg-border-light overflow-hidden">
                    <i className="block h-full rounded" style={{ width: `${Math.min(pct, 100)}%`, background: loadColor(pct) }} />
                  </span>
                </span>
                {overdue ? (
                  <span className="text-[9.5px] font-bold rounded-full px-2.5 py-1 bg-danger-bg text-danger shrink-0">1:1 overdue</span>
                ) : (
                  <span className="w-[72px] shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {adding && (
        <ResourceForm
          initial={null}
          onSave={handleCreate}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
