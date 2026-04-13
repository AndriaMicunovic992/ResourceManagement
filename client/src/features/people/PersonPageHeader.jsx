import { useNavigate } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/badges/RoleBadge';
import { resourcePrimaryDomain, domainColor } from '../../lib/resourceUtils';

export default function PersonPageHeader({ resource }) {
  const navigate = useNavigate();
  const domain = resourcePrimaryDomain(resource);
  const color = domainColor(domain);

  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)` }}
    >
      <button
        onClick={() => navigate('/people')}
        className="text-[11px] font-semibold text-text-mid bg-transparent border-0 cursor-pointer hover:text-primary mb-3 p-0"
      >
        ← All people
      </button>
      <div className="flex items-center gap-4">
        <Avatar name={resource.name} color={color} size={64} />
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-text">{resource.name}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {resource.roles?.map((r, i) => <RoleBadge key={i} {...r} />)}
          </div>
          <div className="text-[10px] font-mono text-text-light mt-1">
            Capacity: {resource.capacity} FTE
            {resource.team && ` · Team: ${resource.team.name}`}
          </div>
        </div>
      </div>
    </div>
  );
}
