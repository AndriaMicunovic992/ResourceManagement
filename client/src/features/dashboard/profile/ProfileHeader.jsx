import Avatar from '../../../components/ui/Avatar';
import RoleBadge from '../../../components/badges/RoleBadge';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';

export default function ProfileHeader({ resource }) {
  const domain = resourcePrimaryDomain(resource);
  const color = domainColor(domain);

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)` }}>
      <div className="flex items-center gap-3">
        <Avatar name={resource.name} color={color} size={52} />
        <div>
          <div className="text-xl font-bold text-text">{resource.name}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {resource.roles?.map((r, i) => <RoleBadge key={i} {...r} />)}
          </div>
          <div className="text-[10px] font-mono text-text-light mt-1">Capacity: {resource.capacity} FTE</div>
        </div>
      </div>
    </div>
  );
}
