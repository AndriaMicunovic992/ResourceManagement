import { useNavigate } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/badges/RoleBadge';
import { resourcePrimaryDomain, domainColor } from '../../lib/resourceUtils';

export default function PersonPageHeader({ resource, canEdit, onEdit }) {
  const navigate = useNavigate();
  const domain = resourcePrimaryDomain(resource);
  const color = domainColor(domain);

  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)` }}
    >
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={() => navigate('/people')}
          className="text-[11px] font-semibold text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary p-0"
        >
          ← All people
        </button>
        {canEdit && (
          <button
            onClick={onEdit}
            className="text-[11px] font-semibold text-primary bg-white border border-primary rounded-full px-4 py-1.5 cursor-pointer hover:bg-primary hover:text-white transition"
          >
            ✎ Edit
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Avatar name={resource.name} color={color} size={64} />
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-text">{resource.name}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {resource.roles?.map((r, i) => <RoleBadge key={i} {...r} full />)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-text-light flex-wrap">
            <span className="font-semibold">Capacity: <span className="font-mono text-text-mid">{resource.capacity} FTE</span></span>
            {Array.isArray(resource.teams) && resource.teams.length > 0 && (
              <>
                <span className="text-border">|</span>
                <span className="font-semibold">
                  {resource.teams.length === 1 ? 'Team:' : 'Teams:'}{' '}
                  <span className="text-text-mid">
                    {resource.teams.map((t) => t.name).join(', ')}
                  </span>
                </span>
              </>
            )}
            {(() => {
              const direct = (resource.managerLinks || [])
                .map((l) => l.manager)
                .filter(Boolean);
              const inherited = (resource.teams || [])
                .map((t) => t.manager)
                .filter((m) => m && m.id !== resource.id);
              const all = [];
              const seen = new Set();
              for (const m of [...direct, ...inherited]) {
                if (!m || seen.has(m.id)) continue;
                seen.add(m.id);
                all.push(m);
              }
              if (all.length === 0) return null;
              return (
                <>
                  <span className="text-border">|</span>
                  <span className="font-semibold">
                    {all.length === 1 ? 'Manager:' : 'Managers:'}{' '}
                    <span className="text-text-mid">{all.map((m) => m.name).join(', ')}</span>
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
