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
          <div className="flex items-center gap-3 mt-2 text-[11px] text-text-light">
            <span className="font-semibold">Capacity: <span className="font-mono text-text-mid">{resource.capacity} FTE</span></span>
            {resource.team && (
              <>
                <span className="text-border">|</span>
                <span className="font-semibold">
                  Team: <span className="text-text-mid">{resource.team.name}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
