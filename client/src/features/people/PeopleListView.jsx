import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/badges/RoleBadge';
import Button from '../../components/ui/Button';
import ResourceForm from '../../components/forms/ResourceForm';
import { useData } from '../../contexts/DataContext';
import { useOrg } from '../../contexts/OrgContext';
import { resourcePrimaryDomain, domainColor } from '../../lib/resourceUtils';

export default function PeopleListView() {
  const { resources, teams, addResource } = useData();
  const { canEdit } = useOrg();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [teamId, setTeamId] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources
      .filter((r) => !teamId || (r.teams || []).some((t) => t.id === teamId))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, search, teamId]);

  const handleCreate = async (data) => {
    const created = await addResource(data);
    setAdding(false);
    if (created?.id) navigate(`/people/${created.id}`);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-lg font-bold text-text">People</div>
          <div className="text-[11px] text-text-light">
            {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-white text-text outline-none focus:border-primary min-w-[220px]"
          />
          {teams.length > 0 && (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-white text-text-mid outline-none focus:border-primary cursor-pointer"
            >
              <option value="">All teams</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {canEdit && (
            <Button onClick={() => setAdding(true)}>+ Add person</Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-text-light text-sm py-10 bg-white rounded-xl border border-border">
          No people match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const color = domainColor(resourcePrimaryDomain(r));
            const skillCount = (r.personSkills || []).length;
            return (
              <Link
                key={r.id}
                to={`/people/${r.id}`}
                className="bg-white border border-border rounded-xl p-3 flex items-center gap-3 no-underline hover:shadow-card transition"
              >
                <Avatar name={r.name} color={color} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text truncate">{r.name}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {r.roles?.map((role, i) => <RoleBadge key={i} {...role} small />)}
                  </div>
                  <div className="text-[10px] font-mono text-text-light mt-1">
                    {r.capacity} FTE · {skillCount} {skillCount === 1 ? 'skill' : 'skills'}
                    {Array.isArray(r.teams) && r.teams.length > 0 && ` · ${r.teams.map((t) => t.name).join(', ')}`}
                  </div>
                </div>
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
